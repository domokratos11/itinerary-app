import type { Proposal } from "./schemas";

// Research waiting for review. Like the plan, screens use this interface and
// never the Firebase SDK.
export interface ProposalRepository {
  subscribe(
    tripId: string,
    onProposals: (proposals: Proposal[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  // Saves several together. Proposals are dismissed, never deleted.
  saveMany(tripId: string, proposals: Proposal[]): Promise<void>;
}
