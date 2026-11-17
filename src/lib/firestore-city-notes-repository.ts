import { collection, doc, onSnapshot } from "firebase/firestore";

import {
  CityNotesSchema,
  type CityNotes,
  type CityNotesRepository,
} from "@/domain/city-notes";
import { getDb } from "@/lib/firebase";
import { setDoc } from "@/lib/tracked-firestore";

// Reads and writes trips/{tripId}/cityNotes/{cityId}. Rows that fail the
// schema are skipped.
export class FirestoreCityNotesRepository implements CityNotesRepository {
  subscribe(
    tripId: string,
    onRows: (rows: CityNotes[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      collection(getDb(), "trips", tripId, "cityNotes"),
      (snapshot) => {
        onRows(
          snapshot.docs.flatMap((d) => {
            const result = CityNotesSchema.safeParse(d.data());
            return result.success ? [result.data] : [];
          }),
        );
      },
      (error) => onError?.(error),
    );
  }

  async save(tripId: string, row: CityNotes): Promise<void> {
    await setDoc(doc(getDb(), "trips", tripId, "cityNotes", row.id), row);
  }
}
