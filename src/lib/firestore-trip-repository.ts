import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import type { z } from "zod";

import type { TripRepository } from "@/domain/trip-repository";
import {
  TRIP_COLLECTIONS,
  type TripCollection,
  type TripRecordOf,
} from "@/domain/trip";
import {
  CityRecordSchema,
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
};

// Reads and writes trips/{tripId}/{cities,stays,reservations,places}/{id}.
// Rows that fail their schema are skipped, so one bad write cannot break
// the whole trip.
export class FirestoreTripRepository implements TripRepository {
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
