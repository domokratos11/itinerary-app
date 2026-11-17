import type { CityNotesRepository } from "@/domain/city-notes";
import { FirestoreCityNotesRepository } from "@/lib/firestore-city-notes-repository";

// The one city notes repository the app uses.
export const cityNotesRepository: CityNotesRepository =
  new FirestoreCityNotesRepository();
