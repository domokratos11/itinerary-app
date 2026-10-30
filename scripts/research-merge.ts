/**
 * Merges research results into a data/places/<city>.json seed file.
 * Run with `npm run research:merge -- <city-file> <results.json>`.
 *
 * Results are an array of researched facts (see ResultSchema). A fact is
 * only taken when the result lists at least one source; fields the research
 * left empty never overwrite what the file already has. Identity, priority,
 * the Maps link and the name are never changed. Source URLs go at the end of
 * `notes`, and `verifiedAt` is set to today's date in Asia/Tokyo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

import {
  CATEGORIES,
  PlacesFileSchema,
  type Place,
} from "../src/domain/schemas";

const isoDate = z.iso.date();

export const ResultSchema = z.object({
  id: z.string(),
  category: z.enum(CATEGORIES).nullable().optional(),
  purpose: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  tips: z.array(z.string()).optional(),
  costEstimateJPY: z.number().int().nonnegative().nullable().optional(),
  durationMin: z.number().int().positive().nullable().optional(),
  openingHours: z.string().nullable().optional(),
  closedDates: z.array(isoDate).optional(),
  seasonFrom: isoDate.nullable().optional(),
  seasonTo: isoDate.nullable().optional(),
  websiteUrl: z.url().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  sources: z.array(z.url()),
  confidence: z.enum(["high", "medium", "low"]),
});

export type Result = z.infer<typeof ResultSchema>;

export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
    now,
  );
}

const SOURCES_MARK = " Sources: ";

// The place with the result's facts filled in, or the same place when the
// result has no source. Existing values win over empty research.
export function mergeResult(place: Place, result: Result, date: string): Place {
  if (result.sources.length === 0) return place;
  const pick = <K extends keyof Place>(key: K, next: Place[K] | undefined) =>
    next === undefined || next === null ? place[key] : next;
  const bothCoords = result.lat != null && result.lng != null;
  const baseNotes = (place.notes ?? "").split(SOURCES_MARK)[0];
  return {
    ...place,
    category: pick("category", result.category ?? undefined),
    purpose: pick("purpose", result.purpose),
    description: pick("description", result.description),
    tips: result.tips?.length ? result.tips : place.tips,
    costEstimateJPY: pick("costEstimateJPY", result.costEstimateJPY),
    durationMin: pick("durationMin", result.durationMin),
    openingHours: pick("openingHours", result.openingHours),
    closedDates: result.closedDates?.length
      ? result.closedDates
      : place.closedDates,
    seasonFrom: pick("seasonFrom", result.seasonFrom),
    seasonTo: pick("seasonTo", result.seasonTo),
    websiteUrl: pick("websiteUrl", result.websiteUrl),
    lat: bothCoords ? result.lat! : place.lat,
    lng: bothCoords ? result.lng! : place.lng,
    verifiedAt: date,
    notes:
      `${baseNotes}${SOURCES_MARK}${result.sources.join(" ")}` +
      (result.confidence === "high"
        ? ""
        : ` (${result.confidence} confidence)`),
  };
}

function main() {
  const [fileArg, resultsArg] = process.argv.slice(2);
  if (!fileArg || !resultsArg) {
    console.error(
      "Usage: npm run research:merge -- data/places/<city>.json results.json",
    );
    process.exit(1);
  }
  const places = PlacesFileSchema.parse(
    JSON.parse(readFileSync(fileArg, "utf8")),
  );
  const results = z
    .array(ResultSchema)
    .parse(JSON.parse(readFileSync(resultsArg, "utf8")));
  const date = today();
  let merged = 0;
  const next = places.map((p) => {
    const r = results.find((x) => x.id === p.id);
    if (!r) return p;
    const out = mergeResult(p, r, date);
    if (out !== p) merged++;
    return out;
  });
  const unknown = results.filter((r) => !places.some((p) => p.id === r.id));
  if (unknown.length)
    console.warn(`Not in the file: ${unknown.map((r) => r.id).join(", ")}`);
  writeFileSync(
    fileArg,
    JSON.stringify(PlacesFileSchema.parse(next), null, 2) + "\n",
  );
  console.log(`Merged ${merged} of ${results.length} results into ${fileArg}`);
}

if (process.argv[1]?.endsWith("research-merge.ts")) main();
