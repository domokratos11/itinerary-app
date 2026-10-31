/**
 * Keeps coordinates from Google within the 30-day limit in its terms. Run with
 * `TRIP_ID=<id> npm run maps:refresh` (--all refreshes everything, not only
 * those due). Coordinates that are past the limit and can't be refreshed are
 * deleted; the place ID stays, so the next run can fetch them again.
 *
 * Coordinates you entered yourself are never touched.
 */
import { adminDb } from "./admin-db";
import { fetchLocation, loadEnv, pause, scriptKey } from "./maps-api";
import {
  COORDINATES_MAX_AGE_DAYS,
  coordinatesExpired,
  dueForRefresh,
} from "../src/domain/location";
import { PlaceRecordSchema, StayRecordSchema } from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

async function main() {
  loadEnv();
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error("Set TRIP_ID, e.g. TRIP_ID=abc123 npm run maps:refresh");
    process.exit(1);
  }
  const key = scriptKey();
  const db = adminDb();
  const all = process.argv.includes("--all");
  const now = new Date();
  const stamp = now.toISOString();

  let refreshed = 0;
  let deleted = 0;
  let failed = 0;

  for (const [name, schema] of [
    ["places", PlaceRecordSchema],
    ["stays", StayRecordSchema],
  ] as const) {
    const records = (await db.collection(`trips/${tripId}/${name}`).get()).docs
      .flatMap((d) => {
        const r = schema.safeParse(d.data());
        return r.success ? [r.data] : [];
      })
      .filter(
        (r) =>
          !r.archived &&
          r.googlePlaceId &&
          r.locationSource !== "manual" &&
          (all || dueForRefresh(r, now)),
      );

    for (const record of records) {
      const ref = db.doc(`trips/${tripId}/${name}/${record.id}`);
      let found = null;
      try {
        found = await fetchLocation(key, record.googlePlaceId!);
      } catch (error) {
        console.error(`${record.id}: ${(error as Error).message}`);
        failed += 1;
      }
      await pause();
      if (found) {
        await ref.update({
          googlePlaceId: found.id,
          lat: found.lat,
          lng: found.lng,
          locationFetchedAt: stamp,
          locationSource: "google",
        });
        refreshed += 1;
      } else if (coordinatesExpired(record, now)) {
        await ref.update({
          lat: null,
          lng: null,
          locationFetchedAt: null,
          locationSource: null,
        });
        deleted += 1;
        console.log(
          `${record.id}: over ${COORDINATES_MAX_AGE_DAYS} days old and not refreshed, coordinates deleted`,
        );
      }
    }
  }

  console.log(
    `${refreshed} refreshed, ${deleted} deleted, ${failed} calls failed`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
