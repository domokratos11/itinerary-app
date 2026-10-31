import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { z } from "zod";

import type {
  TripAccess,
  TripChanges,
  TripRepository,
  TripSummary,
} from "@/domain/trip-repository";
import {
  TRIP_COLLECTIONS,
  type TripCollection,
  type TripRecordOf,
} from "@/domain/trip";
import {
  BudgetSchema,
  CityRecordSchema,
  ExpenseRecordSchema,
  HolidayRecordSchema,
  PlaceRecordSchema,
  ReservationRecordSchema,
  StayRecordSchema,
} from "@/domain/schemas";
import { getDb } from "@/lib/firebase";

const SCHEMAS: { [C in TripCollection]: z.ZodType<TripRecordOf[C]> } = {
  cities: CityRecordSchema,
  stays: StayRecordSchema,
  reservations: ReservationRecordSchema,
  places: PlaceRecordSchema,
  holidays: HolidayRecordSchema,
  expenses: ExpenseRecordSchema,
};

const TripDocSchema = z.object({
  name: z.string().nullable().default(null),
  members: z.array(z.string()).default([]),
  budget: BudgetSchema.nullable().default(null).catch(null),
});

// Reads and writes
// trips/{tripId}/{cities,stays,reservations,places,holidays,expenses}/{id}.
// Rows that fail their schema are skipped, so one bad write cannot break
// the whole trip.
export class FirestoreTripRepository implements TripRepository {
  // The rules let only members read the trip document, so reading it is
  // the membership check. A missing document from the offline cache proves
  // nothing, so that waits for the server.
  watchAccess(
    tripId: string,
    onAccess: (access: TripAccess) => void,
  ): () => void {
    return onSnapshot(
      doc(getDb(), "trips", tripId),
      (snapshot) => {
        if (snapshot.exists()) onAccess("member");
        else if (!snapshot.metadata.fromCache) onAccess("missing");
      },
      (error) => {
        if (error.code === "permission-denied") onAccess("denied");
      },
    );
  }

  // The rules allow listing only trips with the user's own email on them,
  // and only with this exact query.
  watchMyTrips(
    email: string,
    onTrips: (trips: TripSummary[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const mine = query(
      collection(getDb(), "trips"),
      where("members", "array-contains", email),
    );
    return onSnapshot(
      mine,
      (snapshot) => {
        if (snapshot.empty && snapshot.metadata.fromCache) return;
        onTrips(
          snapshot.docs.flatMap((d) => {
            const parsed = TripDocSchema.safeParse(d.data());
            return parsed.success ? [{ id: d.id, ...parsed.data }] : [];
          }),
        );
      },
      (error) => onError?.(error),
    );
  }

  // Readable only by the emails on its list, so a refusal means no.
  async canCreateTrips(): Promise<boolean> {
    try {
      return (await getDoc(doc(getDb(), "config", "access"))).exists();
    } catch {
      return false;
    }
  }

  async createTrip(name: string, email: string): Promise<string> {
    const trip = doc(collection(getDb(), "trips"));
    const now = new Date().toISOString();
    await setDoc(trip, {
      name,
      members: [email],
      createdBy: email,
      createdAt: now,
      updatedAt: now,
    });
    return trip.id;
  }

  async updateTrip(tripId: string, changes: TripChanges): Promise<void> {
    await updateDoc(doc(getDb(), "trips", tripId), {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  }

  subscribe(
    tripId: string,
    onRecords: <C extends TripCollection>(
      collection: C,
      records: TripRecordOf[C][],
    ) => void,
    onError?: (collection: TripCollection, error: Error) => void,
  ): () => void {
    const stops = TRIP_COLLECTIONS.map((name) =>
      onSnapshot(
        collection(getDb(), "trips", tripId, name),
        (snapshot) => {
          const schema = SCHEMAS[name];
          const parsed = snapshot.docs.flatMap((d) => {
            const result = schema.safeParse(d.data());
            return result.success ? [result.data] : [];
          });
          onRecords(name, parsed);
        },
        (error) => onError?.(name, error),
      ),
    );
    return () => stops.forEach((stop) => stop());
  }

  async save<C extends TripCollection>(
    tripId: string,
    name: C,
    record: TripRecordOf[C],
  ): Promise<void> {
    await setDoc(doc(getDb(), "trips", tripId, name, record.id), record);
  }

  // A write batch holds at most 500 writes, so larger lists go in chunks.
  async saveMany<C extends TripCollection>(
    tripId: string,
    name: C,
    records: TripRecordOf[C][],
  ): Promise<void> {
    const db = getDb();
    for (let i = 0; i < records.length; i += 450) {
      const batch = writeBatch(db);
      for (const record of records.slice(i, i + 450))
        batch.set(doc(db, "trips", tripId, name, record.id), record);
      await batch.commit();
    }
  }
}
