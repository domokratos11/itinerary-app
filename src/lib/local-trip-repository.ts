import type { TripRepository } from "@/domain/trip-repository";
import {
  TRIP_COLLECTIONS,
  type TripCollection,
  type TripRecordOf,
} from "@/domain/trip";

type Listener = <C extends TripCollection>(
  collection: C,
  records: TripRecordOf[C][],
) => void;

// In-memory trip for tests and previews. Same behaviour as the Firestore
// version: every collection is sent on subscribe and after each save.
export class LocalTripRepository implements TripRepository {
  private data = new Map<string, Map<string, Map<string, unknown>>>();
  private listeners = new Map<string, Set<Listener>>();

  subscribe(tripId: string, onRecords: Listener): () => void {
    const set = this.listeners.get(tripId) ?? new Set();
    set.add(onRecords);
    this.listeners.set(tripId, set);
    for (const name of TRIP_COLLECTIONS)
      onRecords(name, this.list(tripId, name));
    return () => {
      set.delete(onRecords);
    };
  }

  async save<C extends TripCollection>(
    tripId: string,
    name: C,
    record: TripRecordOf[C],
  ): Promise<void> {
    const trip = this.data.get(tripId) ?? new Map();
    const rows = trip.get(name) ?? new Map();
    rows.set(record.id, record);
    trip.set(name, rows);
    this.data.set(tripId, trip);
    for (const listener of this.listeners.get(tripId) ?? [])
      listener(name, this.list(tripId, name));
  }

  private list<C extends TripCollection>(
    tripId: string,
    name: C,
  ): TripRecordOf[C][] {
    const rows = this.data.get(tripId)?.get(name);
    return [...(rows?.values() ?? [])] as TripRecordOf[C][];
  }
}
