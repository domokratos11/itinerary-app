import type { ProposalRepository } from "@/domain/proposal-repository";
import type { Proposal } from "@/domain/schemas";

// In-memory proposals for tests and previews.
export class LocalProposalRepository implements ProposalRepository {
  private trips = new Map<string, Map<string, Proposal>>();
  private listeners = new Map<string, Set<(rows: Proposal[]) => void>>();

  subscribe(
    tripId: string,
    onProposals: (proposals: Proposal[]) => void,
  ): () => void {
    const set = this.listeners.get(tripId) ?? new Set();
    set.add(onProposals);
    this.listeners.set(tripId, set);
    onProposals(this.list(tripId));
    return () => {
      set.delete(onProposals);
    };
  }

  async saveMany(tripId: string, proposals: Proposal[]): Promise<void> {
    const rows = this.trips.get(tripId) ?? new Map<string, Proposal>();
    for (const proposal of proposals) rows.set(proposal.id, proposal);
    this.trips.set(tripId, rows);
    for (const listener of this.listeners.get(tripId) ?? [])
      listener(this.list(tripId));
  }

  private list(tripId: string): Proposal[] {
    return [...(this.trips.get(tripId)?.values() ?? [])];
  }
}
