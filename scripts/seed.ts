/**
 * Copies the data/ files into a trip in Firestore: cities, stays,
 * reservations and places. Run with `TRIP_ID=<id> npm run seed`.
 *
 * Existing documents are left alone, so it is safe to run again; pass
 * --force to overwrite them with the files. The trip ID is read from the
 * environment only and never written to the repo.
 */

import { adminDb } from "./admin-db";
import { TRIP_COLLECTIONS } from "../src/domain/trip";
import { seed } from "../src/lib/catalog";
import { parseTripId } from "../src/lib/trip-id";

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error(
      "Set TRIP_ID to the trip's ID, e.g. TRIP_ID=abc123 npm run seed",
    );
    process.exit(1);
  }
  const force = process.argv.includes("--force");
  const db = adminDb();

  const trip = await db.doc(`trips/${tripId}`).get();
  if (!trip.exists) {
    console.error(
      "No trip with that ID. Create it in the Firebase console first.",
    );
    process.exit(1);
  }

  const now = new Date().toISOString();
  for (const name of TRIP_COLLECTIONS) {
    let written = 0;
    let kept = 0;
    for (const record of seed[name]) {
      const ref = db.doc(`trips/${tripId}/${name}/${record.id}`);
      if (!force && (await ref.get()).exists) {
        kept += 1;
        continue;
      }
      await ref.set({ ...record, updatedAt: now });
      written += 1;
    }
    console.log(`${name}: ${written} written, ${kept} already there`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
