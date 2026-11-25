/**
 * Adds researched food spots to the trip. Run with
 * `TRIP_ID=<id> npm run food-research:push -- <file.json> [more files]`;
 * without --apply it only shows what would change. Each file is a list of
 * city results, in the format of docs/food-research.md. Every file is checked
 * first, so a bad entry stops the run before anything is written.
 *
 * Spots already in that city under the same name (archived ones too) are
 * skipped, so running it twice adds nothing. A category that got spots has
 * its research request closed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { adminDb } from "./admin-db";
import {
  applyFoodResult,
  cancelCategoryResearch,
  foodCategories,
  FoodCategorySchema,
  FoodResultSchema,
  FoodSpotSchema,
  isResearchRequested,
  type FoodResult,
  type FoodSpot,
} from "../src/domain/food";
import { parseTripId } from "../src/lib/trip-id";

export const FoodResultsFileSchema = z.array(FoodResultSchema);

// Every file's results, one entry per city with the spots of all files.
export function readResults(texts: string[]): FoodResult[] {
  const byCity = new Map<string, FoodResult>();
  for (const text of texts)
    for (const result of FoodResultsFileSchema.parse(JSON.parse(text))) {
      const known = byCity.get(result.cityId);
      byCity.set(
        result.cityId,
        known ? { ...known, spots: [...known.spots, ...result.spots] } : result,
      );
    }
  return [...byCity.values()];
}

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  const apply = process.argv.includes("--apply");
  const files = process.argv.slice(2).filter((a) => a !== "--apply");
  if (!tripId || files.length === 0) {
    console.error(
      "Usage: TRIP_ID=abc123 npm run food-research:push -- research/food-results.json [--apply]",
    );
    process.exit(1);
  }
  const results = readResults(files.map((f) => readFileSync(f, "utf8")));
  const db = adminDb();
  const now = new Date();
  const load = async <T>(name: string, schema: z.ZodType<T>): Promise<T[]> =>
    (await db.collection(`trips/${tripId}/${name}`).get()).docs.flatMap((d) => {
      const r = schema.safeParse(d.data());
      return r.success ? [r.data] : [];
    });
  const categories = foodCategories(
    await load("foodCategories", FoodCategorySchema),
  );
  const spots = await load("foodSpots", FoodSpotSchema);

  const writes: { path: string; row: object }[] = [];
  const added: FoodSpot[] = [];
  const filled = new Set<string>();
  for (const result of results) {
    const city = await db.doc(`trips/${tripId}/cities/${result.cityId}`).get();
    if (!city.exists) {
      console.log(`${result.cityId}: no such city, skipped`);
      continue;
    }
    const report = applyFoodResult(
      [...spots, ...added],
      categories,
      result,
      now,
    );
    for (const spot of report.added) {
      writes.push({ path: `trips/${tripId}/foodSpots/${spot.id}`, row: spot });
      filled.add(spot.categoryId);
      added.push(spot);
    }
    console.log(
      `${result.cityId}: ${report.added.length} new, ${report.duplicates.length} already there`,
    );
    for (const line of report.unknownCategory)
      console.log(`  unknown category, skipped: ${line}`);
  }
  for (const category of categories)
    if (isResearchRequested(category) && filled.has(category.id))
      writes.push({
        path: `trips/${tripId}/foodCategories/${category.id}`,
        row: FoodCategorySchema.parse(cancelCategoryResearch(category, now)),
      });

  if (!apply) {
    console.log(
      `${writes.length} writes. Run again with --apply to save them.`,
    );
    process.exit(0);
  }
  for (const { path: p, row } of writes) await db.doc(p).set(row);
  console.log(`${writes.length} saved`);
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
