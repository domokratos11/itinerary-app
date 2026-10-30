import { z } from "zod";

import { PlanItemSchema, type PlanItem } from "./schemas";

export const ACTIVITY_KINDS = [
  "added",
  "moved",
  "reordered",
  "edited",
  "removed",
  "restored",
  "undone",
  "queued",
  "assigned",
  "dismissed",
  "settings",
] as const;

// One change to the trip, written once and never edited
// (trips/{tripId}/activity). Plan changes keep the stop before and after
// as JSON, so they can be undone.
export const ActivitySchema = z.object({
  id: z.string().min(1).max(64),
  at: z.iso.datetime(),
  device: z.string().min(1).max(40),
  kind: z.enum(ACTIVITY_KINDS),
  targetId: z.string().max(64).nullable(),
  summary: z.string().min(1).max(300),
  before: z.string().max(4000).nullable(),
  after: z.string().max(4000).nullable(),
});

export type Activity = z.infer<typeof ActivitySchema>;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityRepository {
  // The newest `limit` entries, newest first, now and after every change.
  subscribe(
    tripId: string,
    limit: number,
    onEntries: (entries: Activity[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  add(tripId: string, entry: Activity): Promise<void>;
}

function parseItem(json: string | null): PlanItem | null {
  if (!json) return null;
  try {
    const result = PlanItemSchema.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// What saving to undo this entry would write, or null when it can't be
// undone: it isn't a plan change, or the stop changed again since.
export function undoFor(
  entry: Activity,
  current: PlanItem | undefined,
  now: Date,
): PlanItem | null {
  const after = parseItem(entry.after);
  if (!after || !current || current.updatedAt !== after.updatedAt) return null;
  const before = parseItem(entry.before);
  const at = now.toISOString();
  // An added stop has no "before": undoing it removes it.
  return before
    ? { ...before, updatedAt: at }
    : { ...current, status: "removed", updatedAt: at };
}
