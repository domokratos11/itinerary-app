import { z } from "zod";

import type { MessageKey, Translate } from "./i18n";
import {
  FieldSourceSchema,
  ProposalFieldsSchema,
  type FieldSource,
  type NearestStation,
  type PlaceRecord,
  type Proposal,
  type ProposalFields,
} from "./schemas";

export type ProposalField = keyof ProposalFields;

const PROPOSAL_FIELD_LABEL: Record<ProposalField, MessageKey> = {
  purpose: "common.whyGo",
  description: "common.about",
  tips: "common.tips",
  costEstimateJPY: "common.cost",
  durationMin: "common.timeNeeded",
  openingHours: "common.openingHours",
  closedDates: "common.closedOn",
  seasonFrom: "common.seasonFrom",
  seasonTo: "common.seasonTo",
  websiteUrl: "common.website",
  notes: "common.notes",
  nearestStation: "common.nearestStation",
  verifiedAt: "common.lastChecked",
};

const PROPOSAL_FIELDS = Object.keys(PROPOSAL_FIELD_LABEL) as ProposalField[];

// The date research was done needs no source of its own.
const NEEDS_NO_SOURCE: ReadonlySet<ProposalField> = new Set(["verifiedAt"]);

export function isOpenProposal(proposal: Pick<Proposal, "status">): boolean {
  return proposal.status === "requested" || proposal.status === "ready";
}

export function newProposal(id: string, placeId: string, now: Date): Proposal {
  const at = now.toISOString();
  return {
    id,
    placeId,
    status: "requested",
    fields: {},
    sources: [],
    notes: null,
    requestedAt: at,
    updatedAt: at,
  };
}

function isEmpty(value: unknown): boolean {
  return value === null || (Array.isArray(value) && value.length === 0);
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

export function formatProposalValue(
  field: ProposalField,
  value: unknown,
  tr: Translate,
): string {
  if (isEmpty(value) || value === undefined) return tr("common.empty");
  if (field === "costEstimateJPY")
    return value === 0
      ? tr("common.free")
      : `¥${(value as number).toLocaleString("en-US")}`;
  if (field === "durationMin")
    return tr("common.minutes", { minutes: value as number });
  if (field === "nearestStation") {
    const station = value as NearestStation;
    return [
      station.name,
      station.lines.join(", "),
      station.walkMin !== null
        ? tr("common.minutesWalk", { minutes: station.walkMin })
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export type ProposalRow = {
  field: ProposalField;
  label: string;
  before: string;
  after: string;
  // "fill" puts a value in an empty field; "change" corrects an existing one,
  // so it needs a closer look.
  kind: "fill" | "change";
  sources: string[];
};

// What accepting this proposal would change. Locked fields and values the
// place already has never appear.
export function proposalRows(
  place: PlaceRecord,
  proposal: Pick<Proposal, "fields" | "sources">,
  tr: Translate,
): ProposalRow[] {
  return changedFields(place, proposal).map((field) => ({
    field,
    label: tr(PROPOSAL_FIELD_LABEL[field]),
    before: formatProposalValue(field, place[field], tr),
    after: formatProposalValue(field, proposal.fields[field], tr),
    kind: isEmpty(place[field]) ? ("fill" as const) : ("change" as const),
    sources: proposal.sources
      .filter((s) => s.field === field)
      .map((s) => s.url),
  }));
}

function changedFields(
  place: PlaceRecord,
  proposal: Pick<Proposal, "fields">,
): ProposalField[] {
  return PROPOSAL_FIELDS.filter((field) => {
    const value = proposal.fields[field];
    return (
      value !== undefined &&
      !place.lockedFields.includes(field) &&
      !same(place[field], value)
    );
  });
}

// The place with the chosen fields from a proposal. Accepted values aren't
// locked: they are research's, and later research may correct them.
export function acceptProposal(
  place: PlaceRecord,
  proposal: Pick<Proposal, "fields" | "sources">,
  accepted: ReadonlySet<string>,
  now: Date,
): PlaceRecord {
  const chosen = changedFields(place, proposal).filter((field) =>
    accepted.has(field),
  );
  const changes = Object.fromEntries(
    chosen.map((field) => [field, proposal.fields[field]]),
  );
  const replaced = new Set<string>(chosen);
  return {
    ...place,
    ...changes,
    sources: [
      ...place.sources.filter((s) => !replaced.has(s.field)),
      ...proposal.sources.filter((s) => replaced.has(s.field)),
    ],
    status: chosen.length > 0 ? "researched" : place.status,
    updatedAt: now.toISOString(),
  };
}

// One entry of a finished research file.
export const ResearchResultSchema = z.object({
  proposalId: z.string().min(1),
  fields: ProposalFieldsSchema,
  sources: z.array(FieldSourceSchema),
  notes: z.string().max(2000).nullable().default(null),
});

export type ResearchResult = z.infer<typeof ResearchResultSchema>;

export type CleanedResearch = {
  fields: ProposalFields;
  sources: FieldSource[];
  dropped: string[];
};

// What may be proposed for this place. Drops anything locked, unknown ("null
// rather than guessed"), unchanged or without a source, and says why, so a
// research run can't quietly slip past the rules.
export function cleanResearch(
  place: PlaceRecord,
  result: Pick<ResearchResult, "fields" | "sources">,
): CleanedResearch {
  const fields: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const field of PROPOSAL_FIELDS) {
    const value = result.fields[field];
    if (value === undefined) continue;
    if (isEmpty(value)) continue;
    if (place.lockedFields.includes(field)) {
      dropped.push(`${field}: locked by a hand edit`);
    } else if (same(place[field], value)) {
      continue;
    } else if (
      !NEEDS_NO_SOURCE.has(field) &&
      !result.sources.some((s) => s.field === field)
    ) {
      dropped.push(`${field}: no source`);
    } else {
      fields[field] = value;
    }
  }
  return {
    fields: fields as ProposalFields,
    sources: result.sources.filter((s) => s.field in fields),
    dropped,
  };
}
