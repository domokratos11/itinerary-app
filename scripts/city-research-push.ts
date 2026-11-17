/**
 * Writes finished city research onto City notes. Run with
 * `TRIP_ID=<id> npm run city-research:push -- <file.json> [more files]`.
 * Each file is a list of city results, in the format of
 * docs/city-research.md. Every file is checked first, so a bad entry stops
 * the run before anything is written.
 *
 * Notes are background text, not facts about a place, so they go straight
 * onto the city; an answer joins the city's earlier answers.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { adminDb } from "./admin-db";
import {
  applyCityResult,
  CityNotesSchema,
  CityResultSchema,
  type CityResult,
} from "../src/domain/city-notes";
import { parseTripId } from "../src/lib/trip-id";

export const CityResultsFileSchema = z.array(CityResultSchema);

// Every file's results, with one entry per city (the last file wins).
export function readResults(texts: string[]): CityResult[] {
  const byCity = new Map<string, CityResult>();
  for (const text of texts)
    for (const result of CityResultsFileSchema.parse(JSON.parse(text)))
      byCity.set(result.cityId, result);
  return [...byCity.values()];
}

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  const files = process.argv.slice(2);
  if (!tripId || files.length === 0) {
    console.error(
      "Usage: TRIP_ID=abc123 npm run city-research:push -- research/city-results.json",
    );
    process.exit(1);
  }
  const results = readResults(files.map((f) => readFileSync(f, "utf8")));
  const db = adminDb();
  const now = new Date();

  const writes: { path: string; row: unknown }[] = [];
  for (const result of results) {
    const city = await db.doc(`trips/${tripId}/cities/${result.cityId}`).get();
    if (!city.exists) {
      console.log(`${result.cityId}: no such city, skipped`);
      continue;
    }
    const docPath = `trips/${tripId}/cityNotes/${result.cityId}`;
    const existing = CityNotesSchema.safeParse(
      (await db.doc(docPath).get()).data(),
    );
    const row = applyCityResult(
      existing.success ? existing.data : null,
      result,
      now,
    );
    if (!row) {
      console.log(`${result.cityId}: no notes to apply, skipped`);
      continue;
    }
    writes.push({ path: docPath, row: CityNotesSchema.parse(row) });
  }
  for (const { path: p, row } of writes) await db.doc(p).set(row as object);
  console.log(`${writes.length} cities updated`);
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
