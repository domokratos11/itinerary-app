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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { adminDb } from "./admin-db";
import { DayResultSchema } from "../src/domain/day-research";
import { cleanResearch, ResearchResultSchema } from "../src/domain/proposals";
import {
  DayResearchSchema,
  PlaceRecordSchema,
  ProposalSchema,
  type DayResearch,
  type Proposal,
} from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

// A results file is the list of place results, or, with day analyses,
// { places: [...], days: [...] }.
export const ResultsFileSchema = z
  .union([
    z.array(ResearchResultSchema),
    z.object({
      places: z.array(ResearchResultSchema).default([]),
      days: z.array(DayResultSchema).default([]),
    }),
  ])
  .transform((file) =>
    Array.isArray(file) ? { places: file, days: [] } : file,
  );

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  const file = process.argv[2];
  if (!tripId || !file) {
    console.error(
      "Usage: TRIP_ID=abc123 npm run research:push -- research/results.json",
    );
    process.exit(1);
  }
  const { places: results, days } = ResultsFileSchema.parse(
    JSON.parse(readFileSync(file, "utf8")),
  );
  const db = adminDb();
  const now = new Date().toISOString();

  // Day analyses go straight onto the day: they are the researcher's view of
  // it, not facts about a place, so there is nothing to accept field by field.
  const dayWrites: { path: string; row: DayResearch }[] = [];
  for (const result of days) {
    const docPath = `trips/${tripId}/dayResearch/${result.date}`;
    const day = DayResearchSchema.safeParse(
      (await db.doc(docPath).get()).data(),
    );
    if (!day.success) {
      console.log(`${result.date}: no such day request, skipped`);
      continue;
    }
    if (day.data.status === "archived") {
      console.log(`${result.date}: request was cancelled, skipped`);
      continue;
    }
    dayWrites.push({
      path: docPath,
      row: DayResearchSchema.parse({
        ...day.data,
        status: "ready",
        analysis: { ...result.analysis, researchedAt: now },
        updatedAt: now,
      }),
    });
  }

  const writes: { path: string; proposal: Proposal }[] = [];
  for (const result of results) {
    const docPath = `trips/${tripId}/proposals/${result.proposalId}`;
    const parsed = ProposalSchema.safeParse(
      (await db.doc(docPath).get()).data(),
    );
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
      path: docPath,
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

  for (const { path: p, proposal } of writes) await db.doc(p).set(proposal);
  for (const { path: p, row } of dayWrites) await db.doc(p).set(row);
  console.log(`${writes.length} proposals ready for review`);
  console.log(`${dayWrites.length} day analyses ready`);
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
