import type { DayResearchRepository } from "@/domain/day-research";
import { FirestoreDayResearchRepository } from "@/lib/firestore-day-research-repository";

// The one day research repository the app uses.
export const dayResearchRepository: DayResearchRepository =
  new FirestoreDayResearchRepository();
