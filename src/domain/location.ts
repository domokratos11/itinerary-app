import { distanceKm, type LatLng } from "@/lib/geo";
import type { Category } from "./schemas";

// Google's terms let us keep its coordinates for 30 consecutive days, after
// which they must be deleted. Refreshing well before that leaves room for a
// missed run during the trip.
export const COORDINATES_MAX_AGE_DAYS = 30;
export const COORDINATES_REFRESH_AFTER_DAYS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

type Located = {
  lat: number | null;
  lng: number | null;
  locationFetchedAt: string | null;
  locationSource: "google" | "manual" | null;
};

function ageDays(record: Located, now: Date): number {
  if (!record.locationFetchedAt) return Infinity;
  return (now.getTime() - Date.parse(record.locationFetchedAt)) / DAY_MS;
}

export function coordinatesExpired(record: Located, now: Date): boolean {
  return (
    record.locationSource === "google" &&
    record.lat !== null &&
    ageDays(record, now) >= COORDINATES_MAX_AGE_DAYS
  );
}

export function dueForRefresh(record: Located, now: Date): boolean {
  if (record.locationSource === "manual") return false;
  if (record.locationSource === null && record.lat !== null) return false;
  return (
    record.lat === null ||
    ageDays(record, now) >= COORDINATES_REFRESH_AFTER_DAYS
  );
}

// A copy that is safe to keep: coordinates from Google are removed, the place
// ID stays so they can be fetched again. Anything else is unchanged.
export function withoutGoogleCoordinates<T extends Located>(record: T): T {
  if (record.locationSource !== "google") return record;
  return {
    ...record,
    lat: null,
    lng: null,
    locationFetchedAt: null,
    locationSource: null,
  };
}

// How far a match may be from the rest of its city before a person should
// confirm it. Day trips are meant to be far away.
export const MATCH_RADIUS_KM = 30;
export const DAYTRIP_RADIUS_KM = 200;
// How far a match may be from coordinates we already have.
export const MATCH_KNOWN_KM = 2;

// The middle of a set of points, which one wrong match can't move far.
export function medianPoint(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const middle = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  return {
    lat: middle(points.map((p) => p.lat)),
    lng: middle(points.map((p) => p.lng)),
  };
}

// Why a match needs confirming, or null when it looks right.
export function doubtfulMatch(input: {
  match: LatLng;
  known: LatLng | null;
  cityCentre: LatLng | null;
  category: Category | null;
}): string | null {
  const { match, known, cityCentre, category } = input;
  if (known) {
    const km = distanceKm(match, known);
    if (km > MATCH_KNOWN_KM)
      return `${km.toFixed(1)} km from the coordinates we already have`;
  }
  if (cityCentre) {
    const km = distanceKm(match, cityCentre);
    const radius = category === "daytrip" ? DAYTRIP_RADIUS_KM : MATCH_RADIUS_KM;
    if (km > radius) return `${km.toFixed(0)} km from the rest of the city`;
  }
  return null;
}
