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

type Listener = <C extends TripCollection>(
  collection: C,
  records: TripRecordOf[C][],
) => void;

// In-memory trip for tests. Same behaviour as the Firestore version: every collection is sent on subscribe and after each save.
export class LocalTripRepository implements TripRepository {
  private data = new Map<string, Map<string, Map<string, unknown>>>();
  private listeners = new Map<string, Set<Listener>>();
  private trips = new Map<string, TripSummary>();
  private tripListeners = new Set<() => void>();

  // Every trip is open unless a test says otherwise.
  constructor(
    private access: TripAccess = "member",
    private creator = true,
  ) {}

  watchAccess(
    _tripId: string,
    onAccess: (access: TripAccess) => void,
  ): () => void {
    onAccess(this.access);
    return () => {};
  }

  watchMyTrips(
    email: string,
    onTrips: (trips: TripSummary[]) => void,
  ): () => void {
    const notify = () =>
      onTrips(
        [...this.trips.values()].filter((t) => t.members.includes(email)),
      );
    this.tripListeners.add(notify);
    notify();
    return () => {
      this.tripListeners.delete(notify);
    };
  }

  async canCreateTrips(): Promise<boolean> {
    return this.creator;
  }

  async createTrip(name: string, email: string): Promise<string> {
    const id = `trip${String(this.trips.size + 1).padStart(6, "0")}`;
    this.trips.set(id, { id, name, members: [email] });
    this.tripListeners.forEach((notify) => notify());
    return id;
  }

  async updateTrip(tripId: string, changes: TripChanges): Promise<void> {
    const trip = this.trips.get(tripId);
    if (trip) this.trips.set(tripId, { ...trip, ...changes });
    this.tripListeners.forEach((notify) => notify());
  }

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
    return this.saveMany(tripId, name, [record]);
  }

  async saveMany<C extends TripCollection>(
    tripId: string,
    name: C,
    records: TripRecordOf[C][],
  ): Promise<void> {
    const trip = this.data.get(tripId) ?? new Map();
    const rows = trip.get(name) ?? new Map();
    for (const record of records) rows.set(record.id, record);
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
