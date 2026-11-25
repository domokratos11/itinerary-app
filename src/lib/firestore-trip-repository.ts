import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { z } from "zod";

import type {
  NewTripOptions,
  TripAccess,
  TripChanges,
  TripRepository,
  TripSummary,
} from "@/domain/trip-repository";
import {
  EMPTY_TRIP,
  TRIP_COLLECTIONS,
  type TripCollection,
  type TripData,
  type TripRecordOf,
} from "@/domain/trip";
import {
  BudgetSchema,
  CashRecordSchema,
  CityRecordSchema,
  ExpenseRecordSchema,
  FlightRecordSchema,
  HolidayRecordSchema,
  PlaceRecordSchema,
  ReservationRecordSchema,
  StayRecordSchema,
  TodoListRecordSchema,
  TodoRecordSchema,
  TripSetupSchema,
  tripDatesOf,
} from "@/domain/schemas";
import { getDb } from "@/lib/firebase";
import { noteServerRead, noteServerState } from "@/lib/last-sync";
import { setDoc, updateDoc, writeBatch } from "@/lib/tracked-firestore";

// Everything under a trip that the app reads, for refreshFromServer. The
// activity log is left out: it only grows, and nothing needs it offline.
const TRIP_SUBCOLLECTIONS = [
  ...TRIP_COLLECTIONS,
  "items",
  "proposals",
  "dayResearch",
  "cityNotes",
  "foodCategories",
  "foodSpots",
] as const;

const SCHEMAS: { [C in TripCollection]: z.ZodType<TripRecordOf[C]> } = {
  cities: CityRecordSchema,
  stays: StayRecordSchema,
  reservations: ReservationRecordSchema,
  places: PlaceRecordSchema,
  holidays: HolidayRecordSchema,
  expenses: ExpenseRecordSchema,
  flights: FlightRecordSchema,
  cash: CashRecordSchema,
  todoLists: TodoListRecordSchema,
  todos: TodoRecordSchema,
};

const TripDocSchema = z
  .object({
    name: z.string().nullable().default(null),
    members: z.array(z.string()).default([]),
    budget: BudgetSchema.nullable().default(null).catch(null),
    // Added later: older trips have none. A pair that isn't valid reads as
    // no dates, and an unknown setup as done, rather than hiding the trip.
    startDate: z.string().nullable().default(null).catch(null),
    endDate: z.string().nullable().default(null).catch(null),
    setup: TripSetupSchema.nullable().default(null).catch(null),
  })
  .transform((trip) => {
    const dates = tripDatesOf(trip);
    return {
      ...trip,
      startDate: dates?.startDate ?? null,
      endDate: dates?.endDate ?? null,
    };
  });

// Reads and writes
// trips/{tripId}/{cities,stays,reservations,places,holidays,expenses,flights,cash,todoLists,todos}/{id}.
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
    // With metadata changes, so the moment the copy starts or stops
    // matching the server is seen even when no data changed (last-sync).
    return onSnapshot(
      doc(getDb(), "trips", tripId),
      { includeMetadataChanges: true },
      (snapshot) => {
        noteServerState(snapshot.metadata.fromCache);
        if (snapshot.exists()) onAccess("member");
        else if (!snapshot.metadata.fromCache) onAccess("missing");
      },
      (error) => {
        if (error.code === "permission-denied") onAccess("denied");
      },
    );
  }

  async refreshFromServer(tripId: string): Promise<number> {
    const db = getDb();
    await getDocFromServer(doc(db, "trips", tripId));
    const sizes = await Promise.all(
      TRIP_SUBCOLLECTIONS.map(async (name) => {
        const snapshot = await getDocsFromServer(
          collection(db, "trips", tripId, name),
        );
        return snapshot.size;
      }),
    );
    noteServerRead();
    return 1 + sizes.reduce((sum, size) => sum + size, 0);
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

  async createTrip(
    name: string,
    email: string,
    options: NewTripOptions = {},
  ): Promise<string> {
    const trip = doc(collection(getDb(), "trips"));
    const now = new Date().toISOString();
    await setDoc(trip, {
      name,
      members: [email],
      createdBy: email,
      createdAt: now,
      updatedAt: now,
      setup: "pending",
      ...(options.dates && {
        startDate: options.dates.startDate,
        endDate: options.dates.endDate,
      }),
    });
    return trip.id;
  }

  async updateTrip(tripId: string, changes: TripChanges): Promise<void> {
    // Firestore refuses undefined values, so unset keys are left out.
    const fields = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    await updateDoc(doc(getDb(), "trips", tripId), {
      ...fields,
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

  // Every collection once, parsed as subscribe does: bad rows are skipped.
  async readTrip(tripId: string): Promise<TripData> {
    const db = getDb();
    const lists = await Promise.all(
      TRIP_COLLECTIONS.map(async (name) => {
        const snapshot = await getDocs(collection(db, "trips", tripId, name));
        const schema: z.ZodType<unknown> = SCHEMAS[name];
        const records = snapshot.docs.flatMap((d) => {
          const result = schema.safeParse(d.data());
          return result.success ? [result.data] : [];
        });
        return [name, records] as const;
      }),
    );
    return { ...EMPTY_TRIP, ...(Object.fromEntries(lists) as TripData) };
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
