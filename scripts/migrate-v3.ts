/**
 * One-time migration: legacy/0[1-5]_*.json (V3 planning files) into
 * data/places/<cityId>.json, in the Place format from src/domain/schemas.
 *
 * Run with `npm run migrate:v3`. Writes the place files, then prints a
 * report of what was dropped or guessed. The V3 files have no coordinates,
 * so lat/lng stay null until the enrichment step fills them.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  PlacesFileSchema,
  type Category,
  type Place,
  type Priority,
} from "../src/domain/schemas";

type LegacyEntry = {
  id: string;
  name: string;
  category?: string;
  area?: string;
  status?: string;
  source?: string;
  day?: string | null;
  book_ahead?: boolean;
  tags?: string[];
  notes?: string;
  hours?: string;
  source_url?: string | null;
  // winter_lights
  window?: string;
  verified?: boolean;
  verified_on?: string;
  // dining
  type?: string;
  maps_query?: string;
};

type LegacyFile = {
  places?: LegacyEntry[];
  doesnt_fit?: LegacyEntry[];
  winter_lights?: LegacyEntry[];
  dining?: LegacyEntry[];
  day_trip_options?: LegacyEntry[];
  kawaguchiko_places?: LegacyEntry[];
};

// Legacy file -> target city. Each file covers one stay; kawaguchiko_places
// inside the Asakusa file belong to their own city.
const FILES: { file: string; cityId: string; cityName: string }[] = [
  { file: "01_tokyo_ueno.json", cityId: "tokyo-ueno", cityName: "Tokyo Ueno" },
  { file: "02_nagoya.json", cityId: "nagoya", cityName: "Nagoya" },
  { file: "03_hiroshima.json", cityId: "hiroshima", cityName: "Hiroshima" },
  { file: "04_osaka.json", cityId: "osaka", cityName: "Osaka" },
  {
    file: "05_tokyo_asakusa.json",
    cityId: "tokyo-asakusa",
    cityName: "Tokyo Asakusa",
  },
];

const KAWAGUCHIKO = { cityId: "kawaguchiko", cityName: "Kawaguchiko" };

const CATEGORY_MAP: Record<string, Category> = {
  "food-market": "food",
  restaurant: "food",
  "food-street": "food",
  food: "food",
  shopping: "shopping",
  mall: "shopping",
  market: "shopping",
  "day-trip": "daytrip",
  temple: "temple",
  shrine: "temple",
};

const PRIORITY_MAP: Record<string, Priority> = {
  planned: "must",
  suggested: "want",
  optional: "maybe",
  unassigned: "maybe",
  unavailable: "maybe",
};

export function categoryFor(legacy?: string, isLights = false): Category {
  if (isLights) return "lights";
  if (!legacy) return "sight";
  return CATEGORY_MAP[legacy] ?? "sight";
}

export function priorityFor(status?: string): Priority {
  return PRIORITY_MAP[status ?? ""] ?? "maybe";
}

// Google Maps search link, no coordinates needed (CLAUDE.md rule 4).
export function buildMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function isGoogleMapsUrl(url: string): boolean {
  return url.includes("google.com/maps") || url.includes("goo.gl");
}

// Keep the V3 facts that have no field in the Place schema.
function buildNotes(
  entry: LegacyEntry,
  cityId: string,
  extra: string[] = [],
): string | null {
  const parts: string[] = [];
  if (entry.notes) parts.push(entry.notes);
  if (entry.window) parts.push(`Season window (V3): ${entry.window}.`);
  if (entry.day) parts.push(`Suggested day (V3): ${entry.day}.`);
  if (entry.book_ahead) parts.push("Book ahead.");
  if (entry.tags?.length) parts.push(`Tags: ${entry.tags.join(", ")}.`);
  if (entry.status === "unavailable") {
    parts.push("Marked unavailable in V3.");
  }
  if (cityId === "osaka" && /kobe/i.test(`${entry.name} ${entry.area ?? ""}`)) {
    parts.push("Kobe day trip.");
  }
  parts.push(...extra);
  return parts.length ? parts.join(" ") : null;
}

export function toPlace(
  entry: LegacyEntry,
  city: { cityId: string; cityName: string },
  opts: { isLights?: boolean; isDining?: boolean } = {},
): Place {
  const query = opts.isDining
    ? (entry.maps_query ?? entry.name)
    : [entry.name, entry.area ?? city.cityName, "Japan"].join(" ");
  const website = entry.source_url ?? null;
  const verified = opts.isLights && entry.verified;

  return {
    // One V3 id has capitals (t1-mAAch-ecute); ids in data/ are lowercase.
    id: entry.id.toLowerCase(),
    cityId: city.cityId,
    mapsUrl: buildMapsUrl(query),
    name: entry.name,
    lat: null,
    lng: null,
    category: opts.isDining
      ? "food"
      : categoryFor(entry.category, opts.isLights),
    purpose: null,
    description: null,
    tips: [],
    costEstimateJPY: null,
    durationMin: null,
    openingHours: entry.hours ?? null,
    closedDates: [],
    seasonFrom: null,
    seasonTo: null,
    priority: priorityFor(entry.status),
    verifiedAt: verified ? (entry.verified_on ?? null) : null,
    websiteUrl:
      website && !isGoogleMapsUrl(website) && /^https?:\/\//.test(website)
        ? website
        : null,
    notes: buildNotes(entry, city.cityId),
  };
}

function convert(data: LegacyFile, city: { cityId: string; cityName: string }) {
  const places: Place[] = [];
  for (const e of data.places ?? []) places.push(toPlace(e, city));
  for (const e of data.doesnt_fit ?? []) places.push(toPlace(e, city));
  for (const e of data.winter_lights ?? []) {
    places.push(toPlace(e, city, { isLights: true }));
  }
  for (const e of data.dining ?? []) {
    places.push(toPlace(e, city, { isDining: true }));
  }
  for (const e of data.day_trip_options ?? []) {
    places.push({
      ...toPlace(e, city),
      category: "daytrip",
      mapsUrl: buildMapsUrl(`${e.name} Japan`),
    });
  }
  return places;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const legacyDir = path.join(root, "legacy");
  const outDir = path.join(root, "data", "places");
  mkdirSync(outDir, { recursive: true });

  const report: string[] = [];
  const byCity = new Map<string, Place[]>();

  for (const { file, cityId, cityName } of FILES) {
    const data: LegacyFile = JSON.parse(
      readFileSync(path.join(legacyDir, file), "utf8"),
    );
    const city = { cityId, cityName };
    const places = convert(data, city);

    // Kawaguchiko places in the Asakusa file go to their own city file.
    const kawa = (data.kawaguchiko_places ?? []).map((e) =>
      toPlace(e, KAWAGUCHIKO),
    );
    byCity.set(cityId, [...(byCity.get(cityId) ?? []), ...places]);
    byCity.set(KAWAGUCHIKO.cityId, [
      ...(byCity.get(KAWAGUCHIKO.cityId) ?? []),
      ...kawa,
    ]);
  }

  for (const [cityId, places] of byCity) {
    const result = PlacesFileSchema.safeParse(places);
    if (!result.success) {
      console.error(`${cityId}: generated data failed the schema`);
      console.error(result.error.issues.slice(0, 5));
      process.exit(1);
    }
    writeFileSync(
      path.join(outDir, `${cityId}.json`),
      JSON.stringify(places, null, 2) + "\n",
    );
    report.push(`${cityId}: ${places.length} place(s) written`);
  }

  report.push("");
  report.push("Dropped from V3 (no field in the new format):");
  report.push(
    "- itinerary, checklist, open_questions, transport, _meta, fx notes",
  );
  report.push(
    "- lodging and stopover rows: moved to data/trip.json (confirmation and price not carried over)",
  );
  report.push("- place 'day' is kept only as text in notes");
  report.push("- place 'tags' are kept only as text in notes");
  report.push("");
  report.push("Guessed or defaulted:");
  report.push(
    "- status -> priority: planned=must, suggested=want, optional/unassigned/unavailable=maybe",
  );
  report.push(
    "- mapsUrl: a Google Maps search from name, area and city (V3 had no Maps links)",
  );
  report.push("- websiteUrl: the V3 source_url, unless it was a Maps link");
  report.push(
    "- lat/lng, purpose, description, tips, cost, duration, closedDates, seasons: null or empty until enrichment",
  );
  report.push(
    "- verifiedAt: only for winter-light entries marked verified in V3",
  );

  console.log(report.join("\n"));
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}
