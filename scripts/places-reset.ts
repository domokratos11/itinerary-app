/**
 * Clears a trip's places for a fresh start. Run with
 * `TRIP_ID=<id> npm run places:reset` to see what would change, then add
 * `-- --apply` to do it. Cities, stays and reservations stay as
 * they are.
 *
 * Records are never deleted: places are archived, the plan stops on them are
 * marked removed and open research proposals dismissed. Coordinates from
 * Google are wiped, because maps:refresh skips archived places and they could
 * not be kept past the 30-day limit.
 *
 * Every active place is archived, so a later run also clears places added
 * since the last one. Check the counts before applying.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

import { adminDb } from "./admin-db";
import { parseTripId } from "../src/lib/trip-id";

type Doc = Record<string, unknown>;

// The fields to change on a place, or null when it needs no change.
export function retiredPlace(place: Doc, stamp: string): Doc | null {
  const google = place.locationSource === "google";
  if (place.archived === true && !google) return null;
  return {
    archived: true,
    updatedAt: stamp,
    ...(google
      ? { lat: null, lng: null, locationFetchedAt: null, locationSource: null }
      : {}),
  };
}

export function retiredItem(item: Doc, stamp: string): Doc | null {
  return item.status === "removed"
    ? null
    : { status: "removed", updatedAt: stamp };
}

export function retiredProposal(proposal: Doc, stamp: string): Doc | null {
  return proposal.status === "requested" || proposal.status === "ready"
    ? { status: "dismissed", updatedAt: stamp }
    : null;
}

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error("Set TRIP_ID, e.g. TRIP_ID=abc123 npm run places:reset");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  const db = adminDb();
  const stamp = new Date().toISOString();

  // Places last, so a run that stops halfway can simply be run again.
  for (const [name, retire] of [
    ["proposals", retiredProposal],
    ["items", retiredItem],
    ["places", retiredPlace],
  ] as const) {
    const docs = (await db.collection(`trips/${tripId}/${name}`).get()).docs;
    let changed = 0;
    for (const doc of docs) {
      const update = retire(doc.data(), stamp);
      if (!update) continue;
      if (apply) await doc.ref.update(update);
      changed += 1;
    }
    console.log(
      `${name}: ${changed} of ${docs.length} ${apply ? "changed" : "would change"}`,
    );
  }

  const bySource = new Map<string, number>();
  const places = await db.collection(`trips/${tripId}/places`).get();
  for (const doc of places.docs) {
    const source = String(doc.data().source);
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
  }
  console.log(
    `places by source: ${[...bySource].map(([s, n]) => `${s} ${n}`).join(", ") || "none"}`,
  );
  if (!apply) console.log("Nothing was changed. Add -- --apply to do it.");
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
