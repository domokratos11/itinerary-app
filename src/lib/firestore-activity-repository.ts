import {
  collection,
  doc,
  limit as take,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import {
  ActivitySchema,
  type Activity,
  type ActivityRepository,
} from "@/domain/activity";
import { getDb } from "@/lib/firebase";

// Reads and writes trips/{tripId}/activity/{id}. Only the newest entries
// are read, so the log can grow without costing more reads.
export class FirestoreActivityRepository implements ActivityRepository {
  subscribe(
    tripId: string,
    limit: number,
    onEntries: (entries: Activity[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const newest = query(
      collection(getDb(), "trips", tripId, "activity"),
      orderBy("at", "desc"),
      take(limit),
    );
    return onSnapshot(
      newest,
      (snapshot) =>
        onEntries(
          snapshot.docs.flatMap((d) => {
            const result = ActivitySchema.safeParse(d.data());
            return result.success ? [result.data] : [];
          }),
        ),
      (error) => onError?.(error),
    );
  }

  async add(tripId: string, entry: Activity): Promise<void> {
    await setDoc(doc(getDb(), "trips", tripId, "activity", entry.id), entry);
  }
}
