import { z } from "zod";

// A Google Maps link pasted into the app and waiting for the next
// enrichment run (research, tips, hours, cost). Stored per trip.
export const QueuedPlaceSchema = z.object({
  id: z.string().min(1).max(64),
  url: z.url().max(500),
  name: z.string().max(200).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  note: z.string().max(500).nullable(),
  createdAt: z.iso.datetime(),
});

export type QueuedPlace = z.infer<typeof QueuedPlaceSchema>;

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
