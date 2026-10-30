/**
 * Exports what is waiting for research: queued links and draft places
 * (links already assigned to a day). Run with `TRIP_ID=<id> npm run queue:pull`.
 *
 * Writes research/queue-<date>.json (git-ignored). Research each entry,
 * then write the finished places with `npm run places:push`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

import { firebaseConfig } from "../src/lib/firebase.config";
import { QueuedPlaceSchema } from "../src/domain/queue";
import { PlaceRecordSchema } from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error("Set TRIP_ID, e.g. TRIP_ID=abc123 npm run queue:pull");
    process.exit(1);
  }
  const db = getFirestore(initializeApp(firebaseConfig));

  const queued = (await getDocs(collection(db, "trips", tripId, "queue"))).docs
    .flatMap((d) => {
      const r = QueuedPlaceSchema.safeParse(d.data());
      return r.success ? [r.data] : [];
    })
    .filter((q) => q.status === "queued");
  const drafts = (await getDocs(collection(db, "trips", tripId, "places"))).docs
    .flatMap((d) => {
      const r = PlaceRecordSchema.safeParse(d.data());
      return r.success ? [r.data] : [];
    })
    .filter((p) => p.status === "draft" && !p.archived);

  const dir = path.resolve(process.cwd(), "research");
  mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `queue-${new Date().toISOString().slice(0, 10)}.json`,
  );
  writeFileSync(file, JSON.stringify({ queued, drafts }, null, 2) + "\n");
  console.log(`${queued.length} queued links, ${drafts.length} draft places`);
  console.log(`Written to ${path.relative(process.cwd(), file)}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
