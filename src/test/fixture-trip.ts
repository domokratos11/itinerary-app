import fixtureJson from "./fixture-trip.json";
import { TripDataSchema } from "@/domain/schemas";
import type { TripData } from "@/domain/trip";

// A small made-up trip for tests. The app itself reads only Firestore, and
// nothing outside tests imports this.
export const fixtureTrip: TripData = TripDataSchema.parse(fixtureJson);
