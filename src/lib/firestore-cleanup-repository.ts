import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  writeBatch,
} from "firebase/firestore";

import type {
  CleanupCollection,
  CleanupRepository,
  RemoteLeftovers,
} from "@/domain/cleanup";
import { getDb } from "@/lib/firebase";

// A write batch holds at most 500 writes, so larger lists go in chunks.
const CHUNK = 450;

export class FirestoreCleanupRepository implements CleanupRepository {
  async countRemote(tripId: string): Promise<RemoteLeftovers> {
    const db = getDb();
    const [history, queue] = await Promise.all([
      getCountFromServer(collection(db, "trips", tripId, "activity")),
      getDocs(collection(db, "trips", tripId, "queue")),
    ]);
    return {
      history: history.data().count,
      queue: queue.size,
      // Links saved before statuses existed have none and were still waiting.
      queueWaiting: queue.docs.filter(
        (d) => (d.data().status ?? "queued") === "queued",
      ).length,
    };
  }

  async remove(
    tripId: string,
    name: CleanupCollection,
    ids: string[],
  ): Promise<void> {
    const db = getDb();
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const id of ids.slice(i, i + CHUNK))
        batch.delete(doc(db, "trips", tripId, name, id));
      await batch.commit();
    }
  }

  async removeAll(tripId: string, name: "activity" | "queue"): Promise<void> {
    const rows = await getDocs(collection(getDb(), "trips", tripId, name));
    await this.remove(
      tripId,
      name as CleanupCollection,
      rows.docs.map((d) => d.id),
    );
  }
}

export const cleanupRepository: CleanupRepository =
  new FirestoreCleanupRepository();
