/**
 * Writes researched places into the trip and marks them "researched".
 * Run with `TRIP_ID=<id> npm run places:push -- <file.json>`.
 *
 * The file is a JSON array of places in the data/places shape. A draft
 * keeps its id, so research for a draft replaces it in place.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";

import { adminDb } from "./admin-db";
import {
  placeRecordDefaults,
  PlaceRecordSchema,
  PlaceSchema,
  type PlaceRecord,
} from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

export const PushFileSchema = z.array(PlaceSchema);

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  const file = process.argv[2];
  if (!tripId || !file) {
    console.error(
      "Usage: TRIP_ID=abc123 npm run places:push -- research/places.json",
    );
    process.exit(1);
  }
  const entries = PushFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const db = adminDb();
  const now = new Date().toISOString();

  for (const place of entries) {
    const ref = db.doc(`trips/${tripId}/places/${place.id}`);
    const existing = await ref.get();
    const before = existing.exists
      ? PlaceRecordSchema.safeParse(existing.data())
      : null;
    const record: PlaceRecord = {
      ...place,
      // What maps:match and the place editor saved is not in the file.
      ...placeRecordDefaults(),
      ...(before?.success
        ? {
            googlePlaceId: before.data.googlePlaceId,
            locationFetchedAt: before.data.locationFetchedAt,
            locationSource: before.data.locationSource,
            nearestStation: before.data.nearestStation,
            sources: before.data.sources,
            lockedFields: before.data.lockedFields,
          }
        : {}),
      status: "researched",
      source: before?.success ? before.data.source : "catalog",
      archived: false,
      updatedAt: now,
    };
    await ref.set(record);
    console.log(`${existing.exists ? "updated" : "added"} ${record.id}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
