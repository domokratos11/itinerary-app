/**
 * Exports research requests for a research run, as described in
 * docs/research-run.md. Run with `TRIP_ID=<id> npm run research:pull`.
 *
 * Normally this exports what was asked for in the app. With --all-missing it
 * first requests research for every place with empty fields, optionally only
 * --city <id> and at most --limit <n>.
 *
 * Requests for a place that has been archived can't be researched, so they are
 * dismissed and listed. Writes research/proposals-<date>.json (git-ignored),
 * or -2, -3 and so on when that file exists, so a list still being researched
 * is never overwritten. With nothing waiting it writes no file.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adminDb } from "./admin-db";
import { missingFields, needsResearch } from "../src/domain/place-edit";
import { isOpenProposal, newProposal } from "../src/domain/proposals";
import {
  PlaceRecordSchema,
  ProposalSchema,
  type Proposal,
} from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

// Requests whose place is archived or gone. `livePlaceIds` comes from the raw
// documents, so a place that merely fails the schema doesn't count as gone.
export function orphanedRequests(
  proposals: Proposal[],
  livePlaceIds: ReadonlySet<string>,
): Proposal[] {
  return proposals.filter(
    (p) => p.status === "requested" && !livePlaceIds.has(p.placeId),
  );
}

// The first name for this date that `taken` says is free.
export function freeFileName(
  date: string,
  taken: (name: string) => boolean,
): string {
  let name = `proposals-${date}.json`;
  for (let n = 2; taken(name); n += 1) name = `proposals-${date}-${n}.json`;
  return name;
}

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error("Set TRIP_ID, e.g. TRIP_ID=abc123 npm run research:pull");
    process.exit(1);
  }
  const db = adminDb();

  const placeDocs = (await db.collection(`trips/${tripId}/places`).get()).docs;
  const places = placeDocs
    .flatMap((d) => {
      const r = PlaceRecordSchema.safeParse(d.data());
      return r.success ? [r.data] : [];
    })
    .filter((p) => !p.archived);
  const livePlaceIds = new Set(
    placeDocs.filter((d) => d.data().archived !== true).map((d) => d.id),
  );
  const cityNames = new Map(
    (await db.collection(`trips/${tripId}/cities`).get()).docs.map((d) => [
      d.id,
      String(d.data().name),
    ]),
  );
  const proposals = (
    await db.collection(`trips/${tripId}/proposals`).get()
  ).docs.flatMap((d) => {
    const r = ProposalSchema.safeParse(d.data());
    return r.success ? [r.data] : [];
  });

  const stamp = new Date().toISOString();
  for (const orphan of orphanedRequests(proposals, livePlaceIds)) {
    await db
      .doc(`trips/${tripId}/proposals/${orphan.id}`)
      .update({ status: "dismissed", updatedAt: stamp });
    orphan.status = "dismissed";
    console.log(`${orphan.placeId}: place is archived, request dismissed`);
  }

  if (process.argv.includes("--all-missing")) {
    const open = new Set(
      proposals.filter(isOpenProposal).map((p) => p.placeId),
    );
    const city = argument("city");
    const limit = Number(argument("limit") ?? Infinity);
    const now = new Date();
    const added = places
      .filter(
        (p) =>
          needsResearch(p) && !open.has(p.id) && (!city || p.cityId === city),
      )
      .slice(0, limit)
      .map((p) => newProposal(crypto.randomUUID(), p.id, now));
    for (const proposal of added) {
      await db.doc(`trips/${tripId}/proposals/${proposal.id}`).set(proposal);
      proposals.push(proposal);
    }
    console.log(`${added.length} new requests`);
  }

  const byId = new Map(places.map((p) => [p.id, p]));
  const requests = proposals
    .filter((proposal) => proposal.status === "requested")
    .flatMap((proposal) => {
      const place = byId.get(proposal.placeId);
      if (!place) return [];
      return [
        {
          proposalId: proposal.id,
          city: cityNames.get(place.cityId) ?? place.cityId,
          missing: missingFields(place),
          lockedFields: place.lockedFields,
          place: {
            id: place.id,
            name: place.name,
            category: place.category,
            mapsUrl: place.mapsUrl,
            purpose: place.purpose,
            description: place.description,
            tips: place.tips,
            costEstimateJPY: place.costEstimateJPY,
            durationMin: place.durationMin,
            openingHours: place.openingHours,
            closedDates: place.closedDates,
            seasonFrom: place.seasonFrom,
            seasonTo: place.seasonTo,
            websiteUrl: place.websiteUrl,
            notes: place.notes,
            nearestStation: place.nearestStation,
          },
        },
      ];
    });

  console.log(`${requests.length} requests waiting for research`);
  if (requests.length === 0) process.exit(0);

  const dir = path.resolve(process.cwd(), "research");
  mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    freeFileName(new Date().toISOString().slice(0, 10), (name) =>
      existsSync(path.join(dir, name)),
    ),
  );
  writeFileSync(file, JSON.stringify(requests, null, 2) + "\n");
  console.log(`Written to ${path.relative(process.cwd(), file)}`);
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
