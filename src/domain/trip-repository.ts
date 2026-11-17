import type { Budget, TripDates, TripSetup } from "./schemas";
import type { TripCollection, TripData, TripRecordOf } from "./trip";

// Whether the signed-in user may open a trip: "member" when their email is
// on the trip's member list, "denied" when it isn't, "missing" when there
// is no trip with that ID.
export type TripAccess = "checking" | "member" | "denied" | "missing";

// A trip the signed-in user belongs to. Trips made before names existed
// have none. Dates and setup came later, so older trips have neither: no
// dates means the days come from the hotels alone, no setup means done.
export type TripSummary = {
  id: string;
  name: string | null;
  members: string[];
  budget?: Budget | null;
  // Both or neither, YYYY-MM-DD, endDate on or after startDate.
  startDate?: string | null;
  endDate?: string | null;
  setup?: TripSetup | null;
};

// Dates change together: both set, or both null to clear them.
export type TripChanges = Partial<Pick<TripSummary, "members" | "budget">> & {
  name?: string;
  setup?: TripSetup;
} & (
    | { startDate?: undefined; endDate?: undefined }
    | { startDate: string; endDate: string }
    | { startDate: null; endDate: null }
  );

// What a new trip starts with besides its name and first member.
export type NewTripOptions = {
  dates?: TripDates | null;
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
  // Makes a trip with this one member and returns its ID. It starts with
  // setup pending, so the setup wizard opens on it.
  createTrip(
    name: string,
    email: string,
    options?: NewTripOptions,
  ): Promise<string>;
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
  // Every record of every collection, read once, archived ones included,
  // parsed as subscribe parses them. For copying from another trip the user
  // is a member of.
  readTrip(tripId: string): Promise<TripData>;
  // Reads the trip and everything under it again from the server, so the
  // device's offline copy is current. Resolves with how many documents came
  // back; rejects without a connection.
  refreshFromServer(tripId: string): Promise<number>;
  // Creates or replaces one record. To retire one, set `archived`; only
  // Clean up in Settings deletes.
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
