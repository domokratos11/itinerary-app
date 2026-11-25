import { collection, doc, onSnapshot } from "firebase/firestore";

import {
  FoodCategorySchema,
  FoodSpotSchema,
  type FoodCategory,
  type FoodRepository,
  type FoodSpot,
} from "@/domain/food";
import { getDb } from "@/lib/firebase";
import { setDoc } from "@/lib/tracked-firestore";

// Reads and writes trips/{tripId}/foodCategories and foodSpots. Rows that
// fail the schema are skipped.
export class FirestoreFoodRepository implements FoodRepository {
  subscribeCategories(
    tripId: string,
    onRows: (rows: FoodCategory[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return watch(tripId, "foodCategories", FoodCategorySchema, onRows, onError);
  }

  subscribeSpots(
    tripId: string,
    onRows: (rows: FoodSpot[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return watch(tripId, "foodSpots", FoodSpotSchema, onRows, onError);
  }

  async saveCategory(tripId: string, row: FoodCategory): Promise<void> {
    await setDoc(doc(getDb(), "trips", tripId, "foodCategories", row.id), row);
  }

  async saveSpot(tripId: string, row: FoodSpot): Promise<void> {
    await setDoc(doc(getDb(), "trips", tripId, "foodSpots", row.id), row);
  }
}

function watch<T>(
  tripId: string,
  name: "foodCategories" | "foodSpots",
  schema: {
    safeParse(data: unknown): { success: true; data: T } | { success: false };
  },
  onRows: (rows: T[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    collection(getDb(), "trips", tripId, name),
    (snapshot) => {
      onRows(
        snapshot.docs.flatMap((d) => {
          const result = schema.safeParse(d.data());
          return result.success ? [result.data] : [];
        }),
      );
    },
    (error) => onError?.(error),
  );
}
