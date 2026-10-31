/**
 * Exports research requests for a research run, as described in
 * docs/research-run.md. Run with `TRIP_ID=<id> npm run research:pull`.
 *
 * Normally this exports what was asked for in the app. With --all-missing it
 * first requests research for every place with empty fields, optionally only
 * --city <id> and at most --limit <n>.
 *
 * Writes research/proposals-<date>.json (git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { adminDb } from "./admin-db";
import { missingFields, needsResearch } from "../src/domain/place-edit";
import { isOpenProposal, newProposal } from "../src/domain/proposals";
import { PlaceRecordSchema, ProposalSchema } from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error("Set TRIP_ID, e.g. TRIP_ID=abc123 npm run research:pull");
    process.exit(1);
  }
  const db = adminDb();

  const places = (await db.collection(`trips/${tripId}/places`).get()).docs
    .flatMap((d) => {
      const r = PlaceRecordSchema.safeParse(d.data());
      return r.success ? [r.data] : [];
    })
    .filter((p) => !p.archived);
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

  const dir = path.resolve(process.cwd(), "research");
  mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `proposals-${new Date().toISOString().slice(0, 10)}.json`,
  );
  writeFileSync(file, JSON.stringify(requests, null, 2) + "\n");
  console.log(`${requests.length} requests waiting for research`);
  console.log(`Written to ${path.relative(process.cwd(), file)}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
