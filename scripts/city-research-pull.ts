/**
 * Exports the cities to research for City notes, as described in
 * docs/city-research.md. Run with `TRIP_ID=<id> npm run city-research:pull`.
 *
 * Normally this exports what was asked for in the app (status "requested":
 * "Request notes" or "Research specifics"). With --missing it also takes every
 * city that has no notes yet; --city <id> narrows to one city. Writes
 * research/cities-<date>.json (git-ignored), or -2, -3 and so on when that
 * file exists. With nothing to research it writes no file.
 *
 * Only names and dates go in the file: no coordinates, nothing from Google.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { adminDb } from "./admin-db";
import { freeFileName } from "./research-pull";
import {
  CityNotesSchema,
  cityResearchRequests,
} from "../src/domain/city-notes";
import {
  CityRecordSchema,
  PlaceRecordSchema,
  StayRecordSchema,
} from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error(
      "Set TRIP_ID, e.g. TRIP_ID=abc123 npm run city-research:pull",
    );
    process.exit(1);
  }
  const db = adminDb();
  const load = async <T>(name: string, schema: z.ZodType<T>): Promise<T[]> =>
    (await db.collection(`trips/${tripId}/${name}`).get()).docs.flatMap((d) => {
      const r = schema.safeParse(d.data());
      return r.success ? [r.data] : [];
    });

  const requests = cityResearchRequests(
    {
      cities: await load("cities", CityRecordSchema),
      stays: await load("stays", StayRecordSchema),
      places: await load("places", PlaceRecordSchema),
      notes: await load("cityNotes", CityNotesSchema),
    },
    {
      missing: process.argv.includes("--missing"),
      only: argument("city"),
    },
  );
  if (requests.length === 0) {
    console.log("Nothing to research. Use --missing for cities without notes.");
    process.exit(0);
  }

  const dir = path.resolve(process.cwd(), "research");
  mkdirSync(dir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const file = path.join(
    dir,
    freeFileName(today, (name) => existsSync(path.join(dir, name)), "cities"),
  );
  writeFileSync(file, JSON.stringify(requests, null, 2) + "\n");
  for (const r of requests)
    console.log(`${r.cityId}: ${r.request ? `asks "${r.request}"` : "notes"}`);
  console.log(`Written to ${path.relative(process.cwd(), file)}`);
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
