import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";

import type { QueueRepository } from "@/domain/queue-repository";
import { QueuedPlaceSchema, type QueuedPlace } from "@/domain/queue";
import { getDb } from "@/lib/firebase";

// Reads and writes trips/{tripId}/queue/{id}. Rows that fail the schema are
// skipped. Newest first.
export class FirestoreQueueRepository implements QueueRepository {
  subscribe(
    tripId: string,
    onItems: (items: QueuedPlace[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const items = collection(getDb(), "trips", tripId, "queue");
    return onSnapshot(
      items,
      (snapshot) => {
        const parsed = snapshot.docs.flatMap((d) => {
          const result = QueuedPlaceSchema.safeParse(d.data());
          return result.success ? [result.data] : [];
        });
        onItems(parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
      },
      (error) => onError?.(error),
    );
  }

  async save(tripId: string, item: QueuedPlace): Promise<void> {
    await setDoc(doc(getDb(), "trips", tripId, "queue", item.id), item);
  }
}
