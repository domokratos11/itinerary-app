import type { PlanRepository } from "@/domain/plan-repository";
import { FirestorePlanRepository } from "@/lib/firestore-plan-repository";

// The one repository the app uses. Screens call it through hooks, never
// through the Firebase SDK directly.
export const planRepository: PlanRepository = new FirestorePlanRepository();
