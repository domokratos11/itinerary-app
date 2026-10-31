/**
 * Writes finished research back as proposals for review in the app. Run with
 * `TRIP_ID=<id> npm run research:push -- <file.json>`. The format is in
 * docs/research-run.md.
 *
 * This never changes a place. Anything locked, without a source or already
 * there is dropped and listed, and the whole file is checked first, so a bad
 * entry stops the run before anything is written.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";

import { adminDb } from "./admin-db";
import { cleanResearch, ResearchResultSchema } from "../src/domain/proposals";
import {
  PlaceRecordSchema,
  ProposalSchema,
  type Proposal,
} from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  const file = process.argv[2];
  if (!tripId || !file) {
    console.error(
      "Usage: TRIP_ID=abc123 npm run research:push -- research/results.json",
    );
    process.exit(1);
  }
  const results = z
    .array(ResearchResultSchema)
    .parse(JSON.parse(readFileSync(file, "utf8")));
  const db = adminDb();
  const now = new Date().toISOString();

  const writes: { path: string; proposal: Proposal }[] = [];
  for (const result of results) {
    const path = `trips/${tripId}/proposals/${result.proposalId}`;
    const parsed = ProposalSchema.safeParse((await db.doc(path).get()).data());
    if (!parsed.success) {
      console.log(`${result.proposalId}: no such request, skipped`);
      continue;
    }
    const proposal = parsed.data;
    if (proposal.status !== "requested" && proposal.status !== "ready") {
      console.log(`${result.proposalId}: already ${proposal.status}, skipped`);
      continue;
    }
    const placeSnapshot = await db
      .doc(`trips/${tripId}/places/${proposal.placeId}`)
      .get();
    const place = PlaceRecordSchema.safeParse(placeSnapshot.data());
    if (!place.success) {
      console.log(`${result.proposalId}: place not found, skipped`);
      continue;
    }
    const { fields, sources, dropped } = cleanResearch(place.data, result);
    for (const reason of dropped) console.log(`${place.data.id}: ${reason}`);
    writes.push({
      path,
      proposal: ProposalSchema.parse({
        ...proposal,
        status: "ready",
        fields,
        sources,
        notes: result.notes,
        updatedAt: now,
      }),
    });
  }

  for (const { path, proposal } of writes) await db.doc(path).set(proposal);
  console.log(`${writes.length} proposals ready for review`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
