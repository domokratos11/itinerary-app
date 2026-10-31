import { z } from "zod";

import { distanceKm, type LatLng } from "@/lib/geo";
import {
  CATEGORIES,
  placeRecordDefaults,
  type Place,
  type PlaceRecord,
  type Stay,
} from "./schemas";
import { uniqueId } from "./trip-edit";

export const QUEUE_STATUSES = ["queued", "promoted", "dismissed"] as const;

// A Google Maps link pasted into the app. It waits as "queued" until it is
// assigned (it becomes a draft place, "promoted") or dismissed. Links saved
// before statuses existed read as queued.
export const QueuedPlaceSchema = z.object({
  id: z.string().min(1).max(64),
  url: z.url().max(500),
  name: z.string().max(200).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  note: z.string().max(500).nullable(),
  createdAt: z.iso.datetime(),
  status: z.enum(QUEUE_STATUSES).default("queued"),
  cityId: z.string().max(64).nullable().default(null),
  placeId: z.string().max(64).nullable().default(null),
  // Chosen while queued and carried into the draft place when assigned.
  category: z.enum(CATEGORIES).nullable().default(null),
  updatedAt: z.iso.datetime().nullable().default(null),
});

export type QueuedPlace = z.infer<typeof QueuedPlaceSchema>;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const SUGGEST_CITY_KM = 30;

// The city a link is probably in: the one with a saved place or hotel
// nearest to it, if that is within SUGGEST_CITY_KM.
export function suggestCity(
  at: { lat: number | null; lng: number | null },
  places: Pick<Place, "cityId" | "lat" | "lng">[],
  stays: Pick<Stay, "cityId" | "lat" | "lng">[] = [],
): string | null {
  if (at.lat === null || at.lng === null) return null;
  const origin: LatLng = { lat: at.lat, lng: at.lng };
  let best: { cityId: string; km: number } | null = null;
  for (const p of [...places, ...stays]) {
    if (p.lat === null || p.lng === null) continue;
    const km = distanceKm(origin, { lat: p.lat, lng: p.lng });
    if (km <= SUGGEST_CITY_KM && (!best || km < best.km))
      best = { cityId: p.cityId, km };
  }
  return best?.cityId ?? null;
}

// A place made from a queued link, with only what the link tells us. The
// enrichment run researches the rest and marks it "researched".
export function draftPlaceFrom(
  item: QueuedPlace,
  input: { cityId: string; name: string; takenIds: Iterable<string> },
  now: Date,
): PlaceRecord {
  return {
    id: uniqueId(`q ${input.name}`, input.takenIds),
    cityId: input.cityId,
    mapsUrl: item.url,
    name: input.name,
    lat: item.lat,
    lng: item.lng,
    category: item.category ?? "sight",
    purpose: item.note,
    description: null,
    tips: [],
    costEstimateJPY: null,
    durationMin: null,
    openingHours: null,
    closedDates: [],
    seasonFrom: null,
    seasonTo: null,
    priority: "want",
    verifiedAt: null,
    websiteUrl: null,
    notes: null,
    status: "draft",
    source: "queue",
    ...placeRecordDefaults(),
    locationSource: item.lat !== null ? "manual" : null,
    archived: false,
    updatedAt: now.toISOString(),
  };
}

// True for a place still waiting for research.
export function isDraft(place: Place): boolean {
  return "status" in place && place.status === "draft";
}

export type ParsedMapsLink = {
  name: string | null;
  lat: number | null;
  lng: number | null;
};

// Accepts full Google Maps place links and short maps.app.goo.gl links.
// Full links carry the name and coordinates in the URL; short links must be
// resolved later, so they only pass the host check.
export function parseMapsLink(input: string): ParsedMapsLink | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const isShort = url.hostname === "maps.app.goo.gl";
  const isFull =
    url.hostname === "www.google.com" && url.pathname.startsWith("/maps");
  if (!isShort && !isFull) return null;
  if (isShort) return { name: null, lat: null, lng: null };

  // /maps/place/<Name>/@lat,lng,... and !3d<lat>!4d<lng> (the exact pin).
  const nameMatch = url.pathname.match(/\/maps\/place\/([^/]+)/);
  const name = nameMatch
    ? decodeURIComponent(nameMatch[1].replace(/\+/g, " ")).trim() || null
    : null;
  const pin = url.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const at = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const coords = pin ?? at;
  return {
    name,
    lat: coords ? Number(coords[1]) : null,
    lng: coords ? Number(coords[2]) : null,
  };
}
