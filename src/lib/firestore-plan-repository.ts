import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";

import type { PlanRepository } from "@/domain/plan-repository";
import { PlanItemSchema, type PlanItem } from "@/domain/schemas";
import { getDb } from "@/lib/firebase";

// Reads and writes trips/{tripId}/items/{itemId}. Rows that fail the schema
// are skipped, so one bad write cannot break the whole day view.
export class FirestorePlanRepository implements PlanRepository {
  subscribe(
    tripId: string,
    onItems: (items: PlanItem[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const items = collection(getDb(), "trips", tripId, "items");
    return onSnapshot(
      items,
      (snapshot) => {
        const parsed = snapshot.docs.flatMap((d) => {
          const result = PlanItemSchema.safeParse(d.data());
          return result.success ? [result.data] : [];
        });
        onItems(parsed);
      },
      (error) => onError?.(error),
    );
  }

  async save(tripId: string, item: PlanItem): Promise<void> {
    // The whole document is written, so the rules see every field.
    // The promise resolves once the server has the write; offline writes
    // are queued by the local cache and sent when the phone reconnects.
    await setDoc(doc(getDb(), "trips", tripId, "items", item.id), item);
  }
}
