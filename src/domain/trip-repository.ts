import type { TripCollection, TripRecordOf } from "./trip";

// Whether the signed-in user may open a trip: "member" when their email is
// on the trip's member list, "denied" when it isn't, "missing" when there
// is no trip with that ID.
export type TripAccess = "checking" | "member" | "denied" | "missing";

// A trip the signed-in user belongs to. Trips made before names existed
// have none.
export type TripSummary = {
  id: string;
  name: string | null;
  members: string[];
};

export type TripChanges = Partial<Pick<TripSummary, "members">> & {
  name?: string;
};

// Screens read and change the trip's structure only through this
// interface. The Firestore implementation is in src/lib; a memory version
// is used in tests.
export interface TripRepository {
  // Calls onAccess now and whenever the answer changes, for example when
  // someone is added to the member list. Returns a function that stops.
  watchAccess(
    tripId: string,
    onAccess: (access: TripAccess) => void,
  ): () => void;
  // Every trip with this lowercase email on its member list, now and after
  // every change. Stays silent while offline with nothing cached, since that
  // proves nothing. Returns a function that stops.
  watchMyTrips(
    email: string,
    onTrips: (trips: TripSummary[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  // Whether this user may create trips. False when that can't be determined.
  canCreateTrips(): Promise<boolean>;
  // Makes a trip with this one member and returns its ID.
  createTrip(name: string, email: string): Promise<string>;
  updateTrip(tripId: string, changes: TripChanges): Promise<void>;
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
  // Saves several records of one collection together, so listeners see
  // them arrive at once.
  saveMany<C extends TripCollection>(
    tripId: string,
    collection: C,
    records: TripRecordOf[C][],
  ): Promise<void>;
}
