import type { FoodRepository } from "@/domain/food";
import { FirestoreFoodRepository } from "@/lib/firestore-food-repository";

// The one food repository the app uses.
export const foodRepository: FoodRepository = new FirestoreFoodRepository();
