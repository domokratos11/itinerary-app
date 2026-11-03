import type { LatLng } from "@/lib/geo";
import type { MapLine, MapPin } from "./maps-service";
import type { Place, PlanItem } from "./schemas";
import { itemsForDay } from "./plan";
import { CATEGORY_COLOR } from "./taxonomy";
import type { Endpoint } from "./trip";

const STOP_COLOR = "#2563eb";
const FINISHED_COLOR = "#6b7280";

// A stop's pin colour, also used for its number on the card.
export function stopColor(status: PlanItem["status"]): string {
  return status === "planned" ? STOP_COLOR : FINISHED_COLOR;
}
const HOTEL_COLOR = "#111827";

export function placePoint(place: {
  lat: number | null;
  lng: number | null;
}): LatLng | null {
  return place.lat !== null && place.lng !== null
    ? { lat: place.lat, lng: place.lng }
    : null;
}

export function endpointPoint(endpoint: Endpoint | null): LatLng | null {
  const location = endpoint?.location;
  return location && "lat" in location ? location : null;
}

const samePoint = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng;

// A city's places, coloured by category with must-sees larger. Places without
// coordinates have no pin.
export function cityPins(places: Place[]): MapPin[] {
  return places.flatMap((place) => {
    const position = placePoint(place);
    if (!position) return [];
    return [
      {
        id: place.id,
        position,
        title: place.name,
        label: null,
        color: CATEGORY_COLOR[place.category],
        emphasised: place.priority === "must",
        clickable: true,
      },
    ];
  });
}

export type DayMap = {
  pins: MapPin[];
  // The day's points in order, for drawing what connects them.
  route: LatLng[];
  // Stops with no coordinates yet, which can't be shown.
  unpinned: number;
};

// A day's stops as numbered pins in order, with the hotels at either end. The
// same hotel morning and night gets one pin.
export function dayMap(
  stops: { item: PlanItem; place: Place | undefined }[],
  start: Endpoint | null,
  end: Endpoint | null,
): DayMap {
  const pins: MapPin[] = [];
  const route: LatLng[] = [];
  const hotelPin = (id: string, name: string, position: LatLng): MapPin => ({
    id,
    position,
    title: name,
    label: "H",
    color: HOTEL_COLOR,
    emphasised: true,
    clickable: false,
  });

  const startPoint = endpointPoint(start);
  if (start && startPoint) {
    pins.push(hotelPin("hotel-start", start.name, startPoint));
    route.push(startPoint);
  }
  let unpinned = 0;
  stops.forEach(({ item, place }, index) => {
    const position = place ? placePoint(place) : null;
    if (!place || !position) {
      unpinned += 1;
      return;
    }
    pins.push({
      id: place.id,
      position,
      title: place.name,
      label: String(index + 1),
      color: stopColor(item.status),
      emphasised: false,
      clickable: true,
    });
    route.push(position);
  });
  const endPoint = endpointPoint(end);
  if (end && endPoint) {
    if (!startPoint || !samePoint(startPoint, endPoint))
      pins.push(hotelPin("hotel-end", end.name, endPoint));
    if (route.length > 1 || !startPoint || !samePoint(startPoint, endPoint))
      route.push(endPoint);
  }
  return { pins, route, unpinned };
}

// Straight connections between a day's points, until real routes are known.
export function straightLines(route: LatLng[]): MapLine[] {
  return route.slice(1).map((to, i) => ({
    path: [route[i], to],
    kind: "straight" as const,
  }));
}

// One colour per chosen day, in date order, as Wanderlog does.
export const DAY_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

export type DayLegend = { date: string; color: string; stops: number };

export type DayFilterMap = {
  // The places on any chosen day, for the list as well as the map.
  placeIds: Set<string>;
  pins: MapPin[];
  legend: DayLegend[];
};

// A city's stops on the chosen days, each day in its own colour and numbered
// in its order. A place on two chosen days shows once, with the earlier day.
// `places` are the city's own, so stops elsewhere on a transfer day are left
// out.
export function dayFilterPins(
  dates: string[],
  items: PlanItem[],
  places: Map<string, Place>,
): DayFilterMap {
  const placeIds = new Set<string>();
  const pins: MapPin[] = [];
  const legend: DayLegend[] = [];
  [...dates].sort().forEach((date, index) => {
    const color = DAY_COLORS[index % DAY_COLORS.length];
    const stops = itemsForDay(items, date).flatMap((item) => {
      const place = places.get(item.placeId);
      return place ? [place] : [];
    });
    legend.push({ date, color, stops: stops.length });
    stops.forEach((place, order) => {
      if (placeIds.has(place.id)) return;
      placeIds.add(place.id);
      const position = placePoint(place);
      if (!position) return;
      pins.push({
        id: place.id,
        position,
        title: place.name,
        label: String(order + 1),
        color,
        emphasised: false,
        clickable: true,
      });
    });
  });
  return { placeIds, pins, legend };
}
