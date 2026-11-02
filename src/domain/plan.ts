import { evenKeys, keyAfter, keyBetween } from "@/lib/order";
import { distanceKm, type LatLng } from "@/lib/geo";
import type { Translate } from "./i18n";
import {
  PRIORITIES,
  type Holiday,
  type PlanItem,
  type Place,
  type Stay,
} from "./schemas";

// Active plan items (not soft-deleted) on one date, in their saved order.
// Order keys are fractional strings, so a plain string sort is correct.
export function itemsForDay(items: PlanItem[], date: string): PlanItem[] {
  return items
    .filter((i) => i.date === date && i.status !== "removed")
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
}

// The places of these cities that aren't on any day yet, researched or not,
// must-sees first. A stop removed from the plan puts its place back here.
export function waitingPlaces<
  T extends Pick<Place, "id" | "cityId" | "priority">,
>(
  places: T[],
  items: Pick<PlanItem, "placeId" | "status">[],
  cityIds: string[],
): T[] {
  const planned = new Set(
    items.filter((i) => i.status !== "removed").map((i) => i.placeId),
  );
  const rank = (place: T) => PRIORITIES.indexOf(place.priority);
  return places
    .filter((p) => cityIds.includes(p.cityId) && !planned.has(p.id))
    .sort((a, b) => rank(a) - rank(b));
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

// Opens Google Maps directions, in transit mode unless told otherwise. Without
// an origin, Maps uses the phone's current location.
export function directionsUrl(
  destination: Location,
  origin?: Location,
  mode: "transit" | "walking" = "transit",
): string {
  const params = [
    "api=1",
    `destination=${formatLocation(destination)}`,
    `travelmode=${mode}`,
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

// Keys for putting an item at `index` in `others` (the day's items without
// it, in order). Usually only the item gets a new key. If two of the day's
// keys are equal or invalid (a restored stop can share its key with one
// added while it was removed, or two phones add at once), no key fits
// between them, so the whole day is re-keyed and `rekeyed` lists the
// other items whose key changed.
export function keysForInsert(
  others: PlanItem[],
  index: number,
): { order: string; rekeyed: { id: string; order: string }[] } {
  const distinct = others.every(
    (i, n) => n === 0 || others[n - 1].order < i.order,
  );
  if (distinct) {
    try {
      return { order: keyAt(others, index), rekeyed: [] };
    } catch {
      // An invalid key: fall through and re-key the day.
    }
  }
  const keys = evenKeys(others.length + 1);
  const order = keys[index];
  const rekeyed = others.flatMap((item, n) => {
    const key = keys[n < index ? n : n + 1];
    return key === item.order ? [] : [{ id: item.id, order: key }];
  });
  return { order, rekeyed };
}

// Straight-line distance between two catalog places, or null if either has
// no coordinates. A rough guide; the day's legs use it offline too.
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
    status: "planned",
    updatedAt: input.now.toISOString(),
  };
}

// Warnings for a stop on a given day: the place is closed that day, or the
// day is outside the season the place is open for.
export function stopWarnings(
  place: Place,
  date: string,
  tr: Translate,
): string[] {
  const warnings: string[] = [];
  if (place.closedDates.includes(date))
    warnings.push(tr("warnings.closedOnDay"));
  const beforeSeason = place.seasonFrom !== null && date < place.seasonFrom;
  const afterSeason = place.seasonTo !== null && date > place.seasonTo;
  if (beforeSeason || afterSeason) warnings.push(tr("warnings.outOfSeason"));
  return warnings;
}

// Estimated cost of some stops. Places without a researched cost are counted
// separately, so an unknown price is never shown as zero.
export function costTotal(places: (Place | undefined)[]): {
  yen: number;
  unpriced: number;
} {
  let yen = 0;
  let unpriced = 0;
  for (const place of places) {
    if (place?.costEstimateJPY == null) unpriced += 1;
    else yen += place.costEstimateJPY;
  }
  return { yen, unpriced };
}

// The first "10:00-21:00" range in a place's free-text hours, if any. Hours
// are researched text ("about 10:00-20:00 (verify)"), so this is a hint.
export function parseHours(
  text: string | null,
): { open: string; close: string } | null {
  const match = text?.match(/(\d{1,2}):(\d{2})\s*[-–~]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const pad = (h: string, m: string) => `${h.padStart(2, "0")}:${m}`;
  return { open: pad(match[1], match[2]), close: pad(match[3], match[4]) };
}

// A softer warning for stops on a holiday or in the New Year closures, for
// places not already known to be closed that day. Temples and shrines are
// open (and busiest) then.
export function holidayWarnings(
  place: Pick<Place, "category" | "closedDates">,
  date: string,
  holidays: Pick<Holiday, "date" | "kind">[],
  tr: Translate,
): string[] {
  const holiday = holidays.find((h) => h.date === date);
  if (!holiday || place.category === "temple") return [];
  if (place.closedDates.includes(date)) return [];
  return [
    holiday.kind === "holiday"
      ? tr("warnings.holiday")
      : tr("warnings.closures"),
  ];
}
