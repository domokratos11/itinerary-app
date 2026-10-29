import { keyAfter, keyBetween } from "@/lib/order";
import { distanceKm, type LatLng } from "@/lib/geo";
import type { PlanItem, Place, Stay } from "./schemas";

// Active plan items (not soft-deleted) on one date, in their saved order.
// Order keys are fractional strings, so a plain string sort is correct.
export function itemsForDay(items: PlanItem[], date: string): PlanItem[] {
  return items
    .filter((i) => i.date === date && i.status !== "removed")
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
}

// The stays that start and end a day. On a normal day both are the same
// hotel. On a transfer day, start is the hotel being left and end is the
// hotel being moved to.
export function hotelsForDay(
  date: string,
  stays: Stay[],
): { start: Stay | null; end: Stay | null } {
  const containing =
    stays.find((s) => s.checkIn <= date && date < s.checkOut) ?? null;
  const leaving = stays.find((s) => s.checkOut === date) ?? null;
  const arriving = stays.find((s) => s.checkIn === date) ?? null;
  const start = leaving ?? containing;
  const end = arriving ?? containing ?? leaving;
  return { start, end };
}

// A location for Maps: exact coordinates when saved, otherwise a text
// search. Directions accept either form.
export type Location = LatLng | { query: string };

export function placeLocation(place: Place): Location {
  if (place.lat !== null && place.lng !== null)
    return { lat: place.lat, lng: place.lng };
  return { query: `${place.name} Japan` };
}

export function stayLocation(stay: Stay): Location {
  if (stay.lat !== null && stay.lng !== null)
    return { lat: stay.lat, lng: stay.lng };
  return { query: `${stay.hotelName} Japan` };
}

function formatLocation(loc: Location): string {
  return "query" in loc
    ? encodeURIComponent(loc.query)
    : `${loc.lat},${loc.lng}`;
}

// Opens Google Maps directions in transit mode. Without an origin, Maps uses
// the phone's current location.
export function directionsUrl(
  destination: Location,
  origin?: Location,
): string {
  const params = [
    "api=1",
    `destination=${formatLocation(destination)}`,
    "travelmode=transit",
  ];
  if (origin) params.push(`origin=${formatLocation(origin)}`);
  return `https://www.google.com/maps/dir/?${params.join("&")}`;
}

export type Leg = { from: string; to: string; url: string };

// Every leg of a day: hotel to stop 1, stop 1 to stop 2, ..., last stop to
// the end hotel. Transit routes can't take intermediate stops, so each leg
// is its own link.
export function legsForDay(
  start: { name: string; location: Location },
  stops: { name: string; location: Location }[],
  end: { name: string; location: Location },
): Leg[] {
  if (stops.length === 0) return [];
  const points = [start, ...stops, end];
  return points.slice(1).map((to, i) => {
    const from = points[i];
    return {
      from: from.name,
      to: to.name,
      url: directionsUrl(to.location, from.location),
    };
  });
}

// The next stop to go to: the first one still planned.
export function nextStop(sorted: PlanItem[]): PlanItem | null {
  return sorted.find((i) => i.status === "planned") ?? null;
}

// Order key for an item placed at `index` in a list that does not contain it.
export function keyAt(list: PlanItem[], index: number): string {
  const before = list[index - 1]?.order ?? null;
  const after = list[index]?.order ?? null;
  return before === null && after === null
    ? keyAfter(null)
    : keyBetween(before, after);
}

// Straight-line distance between two catalog places, or null if either has
// no coordinates.
export function distanceBetweenPlaces(a: Place, b: Place): number | null {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null)
    return null;
  return distanceKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
}

export function newPlanItem(input: {
  id: string;
  placeId: string;
  date: string;
  order: string;
  now: Date;
}): PlanItem {
  return {
    id: input.id,
    placeId: input.placeId,
    date: input.date,
    order: input.order,
    startTime: null,
    durationMin: null,
    note: null,
    status: "planned",
    updatedAt: input.now.toISOString(),
  };
}
