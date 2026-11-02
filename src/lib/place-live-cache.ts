import {
  MapsError,
  type LivePlace,
  type PlacePhoto,
} from "@/domain/maps-service";
import { mapsService } from "@/lib/maps-service-instance";
import { tryTap, type TapKind } from "@/lib/tap-limit";
import { weekdayInTokyo } from "@/lib/tokyo-date";

// Place details load by themselves, so opening the same place again must not
// be another billed call. Memory only: Google's hours, ratings and photos may
// not be stored (CLAUDE.md rule 4), so this empties when the app reloads. Half
// an hour keeps "open now" close to true. Only real calls count to the limit.
export const LIVE_CACHE_MS = 30 * 60_000;

type Entry<T> = { at: number; request: Promise<T> };

const live = new Map<string, Entry<LivePlace>>();
const photos = new Map<string, Entry<PlacePhoto[]>>();
// Which of a place's photos have been shown: each image is billed once.
const shown = new Map<string, Set<number>>();

function remembered<T>(
  store: Map<string, Entry<T>>,
  placeId: string,
  kind: TapKind,
  now: number,
  ask: () => Promise<T>,
): Promise<T> {
  const known = store.get(placeId);
  if (known && now - known.at < LIVE_CACHE_MS) return known.request;
  if (!tryTap(kind)) return Promise.reject(new MapsError("quota"));
  const request = ask();
  store.set(placeId, { at: now, request });
  // A failure shouldn't stick: it may be a lost connection.
  request.catch(() => {
    if (store.get(placeId)?.request === request) store.delete(placeId);
  });
  return request;
}

export function livePlace(
  placeId: string,
  now: number = Date.now(),
): Promise<LivePlace> {
  return remembered(live, placeId, "live", now, () =>
    mapsService.liveDetails(placeId, weekdayInTokyo()),
  );
}

export function placePhotos(
  placeId: string,
  now: number = Date.now(),
): Promise<PlacePhoto[]> {
  return remembered(photos, placeId, "photo", now, () => {
    // The first image is what this call counted; new links start over.
    shown.set(placeId, new Set([0]));
    return mapsService.photos(placeId);
  });
}

export function shownPhotos(placeId: string): Set<number> {
  return new Set(shown.get(placeId) ?? [0]);
}

// Whether this photo may be shown, counting it if it's new.
export function showPhoto(placeId: string, index: number): boolean {
  const known = shown.get(placeId) ?? new Set([0]);
  if (known.has(index)) return true;
  if (!tryTap("photo")) return false;
  shown.set(placeId, new Set([...known, index]));
  return true;
}

export function clearLiveCache(): void {
  live.clear();
  photos.clear();
  shown.clear();
}
