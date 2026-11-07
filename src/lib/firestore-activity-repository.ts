import {
  collection,
  doc,
  getDocs,
  limit as take,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import {
  ActivitySchema,
  type Activity,
  type ActivityRepository,
} from "@/domain/activity";
import { getDb } from "@/lib/firebase";
import { setDoc, writeBatch } from "@/lib/tracked-firestore";

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

  async all(tripId: string): Promise<Activity[]> {
    const rows = await getDocs(
      collection(getDb(), "trips", tripId, "activity"),
    );
    return rows.docs.flatMap((d) => {
      const result = ActivitySchema.safeParse(d.data());
      return result.success ? [result.data] : [];
    });
  }

  // A write batch holds at most 500 writes.
  async saveMany(tripId: string, entries: Activity[]): Promise<void> {
    const db = getDb();
    for (let i = 0; i < entries.length; i += 450) {
      const batch = writeBatch(db);
      for (const entry of entries.slice(i, i + 450))
        batch.set(doc(db, "trips", tripId, "activity", entry.id), entry);
      await batch.commit();
    }
  }
}
