import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
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
}
