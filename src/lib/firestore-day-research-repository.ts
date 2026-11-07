import { collection, doc, onSnapshot } from "firebase/firestore";

import type { DayResearchRepository } from "@/domain/day-research";
import { DayResearchSchema, type DayResearch } from "@/domain/schemas";
import { getDb } from "@/lib/firebase";
import { setDoc } from "@/lib/tracked-firestore";

// Reads and writes trips/{tripId}/dayResearch/{date}. Rows that fail the
// schema are skipped.
export class FirestoreDayResearchRepository implements DayResearchRepository {
  subscribe(
    tripId: string,
    onRows: (rows: DayResearch[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      collection(getDb(), "trips", tripId, "dayResearch"),
      (snapshot) => {
        onRows(
          snapshot.docs.flatMap((d) => {
            const result = DayResearchSchema.safeParse(d.data());
            return result.success ? [result.data] : [];
          }),
        );
      },
      (error) => onError?.(error),
    );
  }

  async save(tripId: string, row: DayResearch): Promise<void> {
    await setDoc(doc(getDb(), "trips", tripId, "dayResearch", row.id), row);
  }
}
