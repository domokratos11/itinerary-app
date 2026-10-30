import type { TripCollection, TripRecordOf } from "./trip";

// Screens read and change the trip's structure only through this
// interface. The Firestore implementation is in src/lib; a memory version
// is used in tests.
export interface TripRepository {
  // Calls onRecords with a collection's full list now and after every
  // change, once per collection. Returns a function that stops listening.
  subscribe(
    tripId: string,
    onRecords: <C extends TripCollection>(
      collection: C,
      records: TripRecordOf[C][],
    ) => void,
    onError?: (collection: TripCollection, error: Error) => void,
  ): () => void;
  // Creates or replaces one record. Records are never deleted; set
  // `archived` instead.
  save<C extends TripCollection>(
    tripId: string,
    collection: C,
    record: TripRecordOf[C],
  ): Promise<void>;
}
