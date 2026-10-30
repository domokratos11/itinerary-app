import type { ActivityRepository } from "@/domain/activity";
import { FirestoreActivityRepository } from "@/lib/firestore-activity-repository";

// The one activity repository the app uses.
export const activityRepository: ActivityRepository =
  new FirestoreActivityRepository();
