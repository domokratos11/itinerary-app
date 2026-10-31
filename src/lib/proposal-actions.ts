import {
  acceptProposal,
  isOpenProposal,
  newProposal,
} from "@/domain/proposals";
import type { PlaceRecord, Proposal } from "@/domain/schemas";
import { t } from "@/lib/i18n";
import { proposalRepository } from "@/lib/proposal-repository-instance";
import { saveRecord } from "@/lib/trip-actions";

// Asks for research on these places, leaving a request for a research run to
// pick up. Places with one already open are skipped. Returns how many were new.
export async function requestResearch(
  tripId: string,
  places: PlaceRecord[],
  existing: Proposal[],
  now: Date = new Date(),
): Promise<number> {
  const open = new Set(
    existing.filter(isOpenProposal).map((proposal) => proposal.placeId),
  );
  const requests = places
    .filter((place) => !open.has(place.id))
    .map((place) => newProposal(crypto.randomUUID(), place.id, now));
  if (requests.length > 0) await proposalRepository.saveMany(tripId, requests);
  return requests.length;
}

function withStatus(
  proposal: Proposal,
  status: Proposal["status"],
  now: Date,
): Proposal {
  return { ...proposal, status, updatedAt: now.toISOString() };
}

// Accepts the chosen fields. The place is saved through saveRecord, so it gets
// the activity log. Returns what's needed to undo.
export async function applyProposal(
  tripId: string,
  proposal: Proposal,
  place: PlaceRecord,
  accepted: ReadonlySet<string>,
  now: Date = new Date(),
): Promise<void> {
  await saveRecord(
    tripId,
    "places",
    acceptProposal(place, proposal, accepted, now),
    t("activity.acceptedResearch", { name: place.name }),
  );
  await proposalRepository.saveMany(tripId, [
    withStatus(proposal, "applied", now),
  ]);
}

export async function undoProposal(
  tripId: string,
  proposal: Proposal,
  before: PlaceRecord,
  now: Date = new Date(),
): Promise<void> {
  await saveRecord(
    tripId,
    "places",
    before,
    t("activity.undidResearch", { name: before.name }),
  );
  await proposalRepository.saveMany(tripId, [
    withStatus(proposal, "ready", now),
  ]);
}

export function setProposalStatus(
  tripId: string,
  proposal: Proposal,
  status: Proposal["status"],
  now: Date = new Date(),
): Promise<void> {
  return proposalRepository.saveMany(tripId, [
    withStatus(proposal, status, now),
  ]);
}
