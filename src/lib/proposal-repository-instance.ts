import type { ProposalRepository } from "@/domain/proposal-repository";
import { FirestoreProposalRepository } from "@/lib/firestore-proposal-repository";

// The one proposal repository the app uses.
export const proposalRepository: ProposalRepository =
  new FirestoreProposalRepository();
