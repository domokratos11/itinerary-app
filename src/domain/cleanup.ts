import type { PlanItem, Proposal } from "./schemas";
import type { TripData } from "./trip";

// Permanent deletion of what's already retired. Nothing is deleted anywhere
// else in the app, and the security rules refuse anything still live.
export const CLEANUP_KINDS = [
  "stays",
  "cities",
  "places",
  "reservations",
  "holidays",
  "expenses",
  "stops",
  "research",
] as const;

export type CleanupKind = (typeof CLEANUP_KINDS)[number];

export type CleanupCollection = keyof TripData | "items" | "proposals";

export type CleanupPlan = {
  // What would go, by collection.
  remove: Partial<Record<CleanupCollection, string[]>>;
  // The rows the person asked about, not what goes along with them.
  count: number;
  // Retired but still used by something live, so kept.
  skipped: number;
};

export type CleanupInput = {
  trip: TripData;
  items: PlanItem[];
  proposals: Proposal[];
};

const finished = (p: Proposal) =>
  p.status === "applied" || p.status === "dismissed";

function archivedOnly(
  rows: { id: string; archived: boolean }[],
  name: CleanupCollection,
): CleanupPlan {
  const ids = rows.filter((r) => r.archived).map((r) => r.id);
  return { remove: { [name]: ids }, count: ids.length, skipped: 0 };
}

export function planCleanup(
  kind: CleanupKind,
  { trip, items, proposals }: CleanupInput,
): CleanupPlan {
  switch (kind) {
    case "stays":
    case "reservations":
    case "holidays":
    case "expenses":
      return archivedOnly(trip[kind], kind);
    case "cities": {
      // A city stays while a live place or hotel still points at it.
      const used = new Set(
        [...trip.places, ...trip.stays]
          .filter((r) => !r.archived)
          .map((r) => r.cityId),
      );
      const archived = trip.cities.filter((c) => c.archived);
      const ids = archived.filter((c) => !used.has(c.id)).map((c) => c.id);
      return {
        remove: { cities: ids },
        count: ids.length,
        skipped: archived.length - ids.length,
      };
    }
    case "places": {
      // A place stays while a stop uses it or research on it is still open.
      // Its removed stops and finished research go with it.
      const usedByStop = new Set(
        items.filter((i) => i.status !== "removed").map((i) => i.placeId),
      );
      const openResearch = new Set(
        proposals.filter((p) => !finished(p)).map((p) => p.placeId),
      );
      const archived = trip.places.filter((p) => p.archived);
      const ids = archived
        .filter((p) => !usedByStop.has(p.id) && !openResearch.has(p.id))
        .map((p) => p.id);
      const gone = new Set(ids);
      return {
        remove: {
          places: ids,
          items: items.filter((i) => gone.has(i.placeId)).map((i) => i.id),
          proposals: proposals
            .filter((p) => gone.has(p.placeId))
            .map((p) => p.id),
        },
        count: ids.length,
        skipped: archived.length - ids.length,
      };
    }
    case "stops": {
      const ids = items.filter((i) => i.status === "removed").map((i) => i.id);
      return { remove: { items: ids }, count: ids.length, skipped: 0 };
    }
    case "research": {
      const ids = proposals.filter(finished).map((p) => p.id);
      return { remove: { proposals: ids }, count: ids.length, skipped: 0 };
    }
  }
}

// Every kind at once. A row reached through two kinds is listed once.
export function planEverything(input: CleanupInput): CleanupPlan {
  const remove: Partial<Record<CleanupCollection, string[]>> = {};
  let count = 0;
  let skipped = 0;
  for (const kind of CLEANUP_KINDS) {
    const plan = planCleanup(kind, input);
    count += plan.count;
    skipped += plan.skipped;
    for (const [name, ids] of Object.entries(plan.remove)) {
      const key = name as CleanupCollection;
      remove[key] = [...new Set([...(remove[key] ?? []), ...ids])];
    }
  }
  return { remove, count, skipped };
}

// What's only known by asking: the change history and links left from the
// Queue, which the app no longer loads.
export type RemoteLeftovers = {
  history: number;
  queue: number;
  queueWaiting: number;
};

export interface CleanupRepository {
  countRemote(tripId: string): Promise<RemoteLeftovers>;
  // Deletes these rows; the rules refuse any that aren't retired.
  remove(
    tripId: string,
    collection: CleanupCollection,
    ids: string[],
  ): Promise<void>;
  // Deletes a whole collection that has no live rows.
  removeAll(tripId: string, collection: "activity" | "queue"): Promise<void>;
}
