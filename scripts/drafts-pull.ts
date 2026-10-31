/**
 * Exports the draft places waiting for research. Run with
 * `TRIP_ID=<id> npm run drafts:pull`.
 *
 * Writes research/drafts-<date>.json (git-ignored). Research each entry,
 * then write the finished places with `npm run places:push`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { adminDb } from "./admin-db";
import { PlaceRecordSchema } from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error("Set TRIP_ID, e.g. TRIP_ID=abc123 npm run drafts:pull");
    process.exit(1);
  }
  const db = adminDb();

  const drafts = (await db.collection(`trips/${tripId}/places`).get()).docs
    .flatMap((d) => {
      const r = PlaceRecordSchema.safeParse(d.data());
      return r.success ? [r.data] : [];
    })
    .filter((p) => p.status === "draft" && !p.archived);

  const dir = path.resolve(process.cwd(), "research");
  mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `drafts-${new Date().toISOString().slice(0, 10)}.json`,
  );
  writeFileSync(file, JSON.stringify({ drafts }, null, 2) + "\n");
  console.log(`${drafts.length} draft places`);
  console.log(`Written to ${path.relative(process.cwd(), file)}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
