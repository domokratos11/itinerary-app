import { distanceKm, type LatLng } from "@/lib/geo";
import {
  directionsUrl,
  placeLocation,
  type Location,
} from "./plan";
import type { Endpoint } from "./trip";
import type { LegMode, LegNote, NearestStation, Place, PlanItem } from "./schemas";

// Up to about here a leg is worth walking and gets a real walking route;
// further than that it gets a link to transit directions in the Maps app.
export const WALK_LEG_MAX_KM = 1.5;

export const LEG_MODE_LABEL: Record<LegMode, string> = {
  train: "Train",
  subway: "Subway",
  bus: "Bus",
  walk: "Walk",
  taxi: "Taxi",
};

export type DayLeg = {
  key: string;
  // Straight-line distance; null when either end has no coordinates.
  km: number | null;
  kind: "walk" | "far" | "unknown";
  from: LatLng | null;
  to: LatLng | null;
  // Opens the Maps app. Null when an end has no location at all.
  directions: string | null;
  note: LegNote | null;
  station: NearestStation | null;
};

function pointOf(location: Location | null): LatLng | null {
  return location && "lat" in location ? location : null;
}

function leg(
  key: string,
  from: Location | null,
  to: Location | null,
  note: LegNote | null,
  station: NearestStation | null,
): DayLeg {
  const fromPoint = pointOf(from);
  const toPoint = pointOf(to);
  const km = fromPoint && toPoint ? distanceKm(fromPoint, toPoint) : null;
  const kind = km === null ? "unknown" : km <= WALK_LEG_MAX_KM ? "walk" : "far";
  return {
    key,
    km,
    kind,
    from: fromPoint,
    to: toPoint,
    directions:
      from && to
        ? directionsUrl(to, from, kind === "walk" ? "walking" : "transit")
        : null,
    note,
    station,
  };
}

// Every leg of a day: hotel to the first stop, stop to stop, and the last stop
// back to the hotel. A leg belongs to the stop it arrives at, and its key is
// that stop's plan item id, or "end" for the way back.
export function dayLegs(
  rows: { item: PlanItem; place: Place | undefined }[],
  start: Endpoint | null,
  end: Endpoint | null,
): DayLeg[] {
  if (rows.length === 0) return [];
  const locationOf = (place: Place | undefined) =>
    place ? placeLocation(place) : null;
  const stationOf = (place: Place | undefined) =>
    place && "nearestStation" in place
      ? (place.nearestStation as NearestStation | null)
      : null;
  const legs = rows.map((row, index) =>
    leg(
      row.item.id,
      index === 0
        ? (start?.location ?? null)
        : locationOf(rows[index - 1].place),
      locationOf(row.place),
      row.item.legNote,
      stationOf(row.place),
    ),
  );
  legs.push(
    leg(
      "end",
      locationOf(rows[rows.length - 1].place),
      end?.location ?? null,
      null,
      null,
    ),
  );
  return legs;
}

export function formatMeters(meters: number): string {
  return meters < 1000
    ? `${Math.max(100, Math.round(meters / 100) * 100)} m`
    : formatKm(meters / 1000);
}

function formatKm(km: number): string {
  const value = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
  return `${value} km`;
}

// A straight-line distance, which is only ever approximate.
export function formatDistance(km: number): string {
  return `About ${formatMeters(km * 1000)}`;
}

export function formatWalk(minutes: number, meters: number): string {
  return `Walk ${minutes} min · ${formatMeters(meters)}`;
}

export function formatLegNote(note: LegNote): string {
  return [
    LEG_MODE_LABEL[note.mode],
    note.minutes !== null ? `about ${note.minutes} min` : "",
    note.fareJPY !== null ? `¥${note.fareJPY.toLocaleString("en-US")}` : "",
    note.text ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function formatStation(station: NearestStation): string {
  return [
    station.name,
    station.lines.join(", "),
    station.walkMin !== null ? `${station.walkMin} min walk` : "",
  ]
    .filter(Boolean)
    .join(", ");
}
