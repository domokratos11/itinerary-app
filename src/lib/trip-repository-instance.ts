import type { TripRepository } from "@/domain/trip-repository";
import { FirestoreTripRepository } from "@/lib/firestore-trip-repository";

// The one trip repository the app uses. Screens call it through hooks and
// trip-actions, never through the Firebase SDK directly.
export const tripRepository: TripRepository = new FirestoreTripRepository();
