/**
 * Removes the stop details the app no longer has (start time, duration, note
 * and the "getting here" note) from a trip's plan items. Run with
 * `TRIP_ID=<id> npm run items:clean` to see what would change, then add
 * `-- --apply` to do it. Nothing else on a stop changes, and running it again
 * finds nothing to do.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "./admin-db";
import { parseTripId } from "../src/lib/trip-id";

export const RETIRED_FIELDS = [
  "startTime",
  "durationMin",
  "note",
  "legNote",
] as const;

// Which retired fields this item still has, and which of them held something.
export function retiredFields(item: Record<string, unknown>): {
  present: string[];
  filled: string[];
} {
  const present = RETIRED_FIELDS.filter((field) => field in item);
  return {
    present,
    filled: present.filter((field) => item[field] != null),
  };
}

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error("Set TRIP_ID, e.g. TRIP_ID=abc123 npm run items:clean");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  const docs = (await adminDb().collection(`trips/${tripId}/items`).get()).docs;
  let changed = 0;
  let filled = 0;
  for (const doc of docs) {
    const found = retiredFields(doc.data());
    if (found.present.length === 0) continue;
    if (found.filled.length > 0) filled += 1;
    if (apply)
      await doc.ref.update(
        Object.fromEntries(
          found.present.map((field) => [field, FieldValue.delete()]),
        ),
      );
    changed += 1;
  }
  console.log(
    `items: ${changed} of ${docs.length} ${apply ? "changed" : "would change"}, ${filled} with something filled in`,
  );
  if (!apply) console.log("Nothing was changed. Add -- --apply to do it.");
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
