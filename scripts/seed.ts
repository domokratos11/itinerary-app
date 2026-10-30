/**
 * Copies the data/ files into a trip in Firestore: cities, stays,
 * reservations and places. Run with `TRIP_ID=<id> npm run seed`.
 *
 * Existing documents are left alone, so it is safe to run again; pass
 * --force to overwrite them with the files. The trip ID is read from the
 * environment only and never written to the repo.
 */
import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

import { firebaseConfig } from "../src/lib/firebase.config";
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
  const db = getFirestore(initializeApp(firebaseConfig));

  const trip = await getDoc(doc(db, "trips", tripId));
  if (!trip.exists()) {
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
      const ref = doc(db, "trips", tripId, name, record.id);
      if (!force && (await getDoc(ref)).exists()) {
        kept += 1;
        continue;
      }
      await setDoc(ref, { ...record, updatedAt: now });
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
