/**
 * Writes flights into the trip from a file. Run with
 * `TRIP_ID=<id> npm run flights:push -- research/flights.json`, adding
 * `-- --apply` after the file to save them; without it nothing changes.
 *
 * The file holds confirmation numbers and names, so it stays in the git-ignored
 * research/ folder and is never committed (CLAUDE.md rule 9). A flight with the
 * same id is replaced, so running it again is safe.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

import { adminDb } from "./admin-db";
import { FlightRecordSchema, type FlightRecord } from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

export const FlightsFileSchema = z.array(
  FlightRecordSchema.omit({ archived: true, updatedAt: true }),
);

export function flightRecords(file: unknown, now: Date): FlightRecord[] {
  return FlightsFileSchema.parse(file).map((flight) => ({
    ...flight,
    archived: false,
    updatedAt: now.toISOString(),
  }));
}

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  const file = process.argv[2];
  if (!tripId || !file) {
    console.error(
      "Usage: TRIP_ID=abc123 npm run flights:push -- research/flights.json --apply",
    );
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  const flights = flightRecords(
    JSON.parse(readFileSync(file, "utf8")),
    new Date(),
  );
  const db = adminDb();
  for (const flight of flights) {
    const ref = db.doc(`trips/${tripId}/flights/${flight.id}`);
    const existed = (await ref.get()).exists;
    if (apply) await ref.set(flight);
    const did = apply ? "" : "would be ";
    console.log(`${did}${existed ? "updated" : "added"}: ${flight.id}`);
  }
  if (!apply) console.log("Nothing was changed. Add --apply to do it.");
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
