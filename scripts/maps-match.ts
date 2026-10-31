/**
 * Matches places and hotels to Google: saves each one's place ID and
 * coordinates. Run with `TRIP_ID=<id> npm run maps:match`.
 *
 * Options: --limit <n> stops after n matches, --city <id> does one city.
 *
 * Matches that look wrong are not saved. They go to
 * research/map-matches-<date>.json (git-ignored) with a link to check each
 * one. Set "accept": true on the right ones, then run
 * `TRIP_ID=<id> npm run maps:match -- --apply <file>`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { adminDb } from "./admin-db";
import {
  fetchLocation,
  loadEnv,
  pause,
  scriptKey,
  searchPlaceId,
  type FetchedLocation,
} from "./maps-api";
import { doubtfulMatch, medianPoint } from "../src/domain/location";
import {
  PlaceRecordSchema,
  StayRecordSchema,
  type Category,
} from "../src/domain/schemas";
import type { LatLng } from "../src/lib/geo";
import { parseTripId } from "../src/lib/trip-id";

type Target = {
  collection: "places" | "stays";
  id: string;
  name: string;
  cityId: string;
  category: Category | null;
  known: LatLng | null;
};

const ReviewFileSchema = z.array(
  z.object({
    collection: z.enum(["places", "stays"]),
    id: z.string(),
    name: z.string(),
    placeId: z.string().nullable(),
    reason: z.string(),
    checkUrl: z.string().nullable(),
    accept: z.boolean(),
  }),
);

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function coords(r: { lat: number | null; lng: number | null }): LatLng | null {
  return r.lat !== null && r.lng !== null ? { lat: r.lat, lng: r.lng } : null;
}

function checkUrl(name: string, placeId: string): string {
  const query = encodeURIComponent(name);
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
}

// Coordinates we already have stay as they are, marked manual. Only the place
// ID is added, so they aren't subject to the 30-day limit.
function matchedFields(
  target: Target,
  found: FetchedLocation,
  now: string,
): Record<string, unknown> {
  const base = { googlePlaceId: found.id, updatedAt: now };
  return target.known
    ? { ...base, locationSource: "manual" }
    : {
        ...base,
        lat: found.lat,
        lng: found.lng,
        locationFetchedAt: now,
        locationSource: "google",
      };
}

async function applyReview(
  db: FirebaseFirestore.Firestore,
  tripId: string,
  key: string,
  file: string,
) {
  const rows = ReviewFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const now = new Date().toISOString();
  let saved = 0;
  for (const row of rows) {
    if (!row.accept || !row.placeId) continue;
    const found = await fetchLocation(key, row.placeId);
    await pause();
    if (!found) {
      console.log(`Google no longer knows ${row.name}, skipped`);
      continue;
    }
    await db.doc(`trips/${tripId}/${row.collection}/${row.id}`).update({
      googlePlaceId: found.id,
      lat: found.lat,
      lng: found.lng,
      locationFetchedAt: now,
      locationSource: "google",
      updatedAt: now,
    });
    saved += 1;
  }
  console.log(`${saved} confirmed matches saved`);
}

async function main() {
  loadEnv();
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error("Set TRIP_ID, e.g. TRIP_ID=abc123 npm run maps:match");
    process.exit(1);
  }
  const key = scriptKey();
  const db = adminDb();

  const applyFile = argument("apply");
  if (applyFile) {
    await applyReview(db, tripId, key, applyFile);
    process.exit(0);
  }

  const onlyCity = argument("city");
  const limitArg = argument("limit");
  const limit = limitArg ? Number(limitArg) : Infinity;

  const cityNames = new Map(
    (await db.collection(`trips/${tripId}/cities`).get()).docs.map((d) => [
      d.id,
      String(d.data().name),
    ]),
  );
  const places = (await db.collection(`trips/${tripId}/places`).get()).docs
    .flatMap((d) => {
      const r = PlaceRecordSchema.safeParse(d.data());
      return r.success ? [r.data] : [];
    })
    .filter((p) => !p.archived);
  const stays = (await db.collection(`trips/${tripId}/stays`).get()).docs
    .flatMap((d) => {
      const r = StayRecordSchema.safeParse(d.data());
      return r.success ? [r.data] : [];
    })
    .filter((s) => !s.archived);
  if (places.length === 0 && stays.length === 0) {
    console.error("Nothing in this trip yet. Add its cities and stays in the app first.");
    process.exit(1);
  }

  const targets: Target[] = [
    ...places
      .filter((p) => !p.googlePlaceId)
      .map((p) => ({
        collection: "places" as const,
        id: p.id,
        name: p.name,
        cityId: p.cityId,
        category: p.category,
        known: coords(p),
      })),
    ...stays
      .filter(
        (s) =>
          !s.googlePlaceId &&
          !s.hotelName.toLowerCase().startsWith("to be decided"),
      )
      .map((s) => ({
        collection: "stays" as const,
        id: s.id,
        name: s.hotelName,
        cityId: s.cityId,
        category: null,
        known: coords(s),
      })),
  ]
    .filter((t) => !onlyCity || t.cityId === onlyCity)
    .slice(0, limit);

  console.log(`Matching ${targets.length} places and hotels`);
  const found: { target: Target; location: FetchedLocation }[] = [];
  const review: z.infer<typeof ReviewFileSchema> = [];

  for (const target of targets) {
    const city = (cityNames.get(target.cityId) ?? "").replace(/[()]/g, " ");
    const placeId = await searchPlaceId(
      key,
      `${target.name}, ${city}, Japan`.replace(/\s+/g, " "),
    );
    await pause();
    const location = placeId ? await fetchLocation(key, placeId) : null;
    await pause();
    if (location) found.push({ target, location });
    else
      review.push({
        collection: target.collection,
        id: target.id,
        name: target.name,
        placeId: null,
        reason: "No match found. Add it in the app or fix its name.",
        checkUrl: null,
        accept: false,
      });
  }

  // The middle of each city, from everything known and everything just found.
  const pointsByCity = new Map<string, LatLng[]>();
  const addPoint = (cityId: string, point: LatLng | null) => {
    if (!point) return;
    pointsByCity.set(cityId, [...(pointsByCity.get(cityId) ?? []), point]);
  };
  for (const p of places)
    if (p.category !== "daytrip") addPoint(p.cityId, coords(p));
  for (const s of stays) addPoint(s.cityId, coords(s));
  for (const { target, location } of found)
    if (target.category !== "daytrip") addPoint(target.cityId, location);

  const now = new Date().toISOString();
  let saved = 0;
  for (const { target, location } of found) {
    const reason = doubtfulMatch({
      match: location,
      known: target.known,
      cityCentre: medianPoint(pointsByCity.get(target.cityId) ?? []),
      category: target.category,
    });
    if (reason) {
      review.push({
        collection: target.collection,
        id: target.id,
        name: target.name,
        placeId: location.id,
        reason,
        checkUrl: checkUrl(target.name, location.id),
        accept: false,
      });
      continue;
    }
    await db
      .doc(`trips/${tripId}/${target.collection}/${target.id}`)
      .update(matchedFields(target, location, now));
    saved += 1;
  }

  console.log(`${saved} saved, ${review.length} to confirm`);
  if (review.length > 0) {
    const dir = path.resolve(process.cwd(), "research");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `map-matches-${now.slice(0, 10)}.json`);
    writeFileSync(file, JSON.stringify(review, null, 2) + "\n");
    console.log(`Check them in ${path.relative(process.cwd(), file)}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
