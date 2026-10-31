import type { LatLng } from "@/lib/geo";
import type { MapLine, MapPin } from "./maps-service";
import type { Category, Place, PlanItem } from "./schemas";
import type { Endpoint } from "./trip";

export const CATEGORY_PIN_COLOR: Record<Category, string> = {
  lights: "#a855f7",
  food: "#ea580c",
  shopping: "#db2777",
  sight: "#2563eb",
  daytrip: "#0d9488",
  temple: "#b91c1c",
};

const STOP_COLOR = "#2563eb";
const FINISHED_COLOR = "#6b7280";
const HOTEL_COLOR = "#111827";

export function placePoint(place: {
  lat: number | null;
  lng: number | null;
}): LatLng | null {
  return place.lat !== null && place.lng !== null
    ? { lat: place.lat, lng: place.lng }
    : null;
}

function endpointPoint(endpoint: Endpoint | null): LatLng | null {
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
        color: CATEGORY_PIN_COLOR[place.category],
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
    emphasised: false,
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
      color: item.status === "planned" ? STOP_COLOR : FINISHED_COLOR,
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
