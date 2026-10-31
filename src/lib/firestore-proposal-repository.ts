import { collection, doc, onSnapshot, writeBatch } from "firebase/firestore";

import type { ProposalRepository } from "@/domain/proposal-repository";
import { ProposalSchema, type Proposal } from "@/domain/schemas";
import { getDb } from "@/lib/firebase";

// Reads and writes trips/{tripId}/proposals/{id}. Rows that fail the schema
// are skipped.
export class FirestoreProposalRepository implements ProposalRepository {
  subscribe(
    tripId: string,
    onProposals: (proposals: Proposal[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      collection(getDb(), "trips", tripId, "proposals"),
      (snapshot) => {
        onProposals(
          snapshot.docs.flatMap((d) => {
            const result = ProposalSchema.safeParse(d.data());
            return result.success ? [result.data] : [];
          }),
        );
      },
      (error) => onError?.(error),
    );
  }

  // A write batch holds at most 500 writes, so larger lists go in chunks.
  async saveMany(tripId: string, proposals: Proposal[]): Promise<void> {
    const db = getDb();
    for (let i = 0; i < proposals.length; i += 450) {
      const batch = writeBatch(db);
      for (const proposal of proposals.slice(i, i + 450))
        batch.set(doc(db, "trips", tripId, "proposals", proposal.id), proposal);
      await batch.commit();
    }
  }
}
