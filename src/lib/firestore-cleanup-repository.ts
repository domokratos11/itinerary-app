import {
  collection,
  deleteDoc,
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
import { SHARED_COLLECTIONS } from "@/domain/share";
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

  async queueLinks(tripId: string): Promise<Record<string, unknown>[]> {
    const rows = await getDocs(collection(getDb(), "trips", tripId, "queue"));
    return rows.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  async removeShare(shareId: string): Promise<void> {
    const db = getDb();
    // The copy first, so an interrupted run leaves the link to try again.
    for (const name of SHARED_COLLECTIONS) {
      const rows = await getDocs(collection(db, "shares", shareId, name));
      for (let i = 0; i < rows.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const row of rows.docs.slice(i, i + CHUNK)) batch.delete(row.ref);
        await batch.commit();
      }
    }
    await deleteDoc(doc(db, "shares", shareId));
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
