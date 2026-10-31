import { BASE_PATH } from "@/lib/base-path";

// The trip ID is the Firestore document ID, so it is kept to safe characters.
// It lives in links and in this browser's localStorage, never in the repo.
const TRIP_ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const STORAGE_KEY = "trip-id";

export function parseTripId(value: string | null | undefined): string | null {
  if (!value) return null;
  return TRIP_ID_PATTERN.test(value) ? value : null;
}

// localStorage can throw in private windows or with blocked site data, so
// failures fall back to "no remembered trip".
export function rememberTripId(tripId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, tripId);
  } catch {
    // Not remembered; the trip list still finds it after sign-in.
  }
}

export function recallTripId(): string | null {
  try {
    return parseTripId(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function forgetTripId(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to forget.
  }
}

// Which trip to open once the user's trips are known. `trips` is null when
// the list couldn't be read; the remembered trip is still tried, and its
// access check decides. A trip in a link is always tried for the same reason.
export function chooseTrip(input: {
  fromUrl: string | null;
  remembered: string | null;
  lastTripId: string | null;
  trips: string[] | null;
}): string | null {
  const fromUrl = parseTripId(input.fromUrl);
  if (fromUrl) return fromUrl;
  if (input.trips === null) return input.remembered;
  for (const id of [input.remembered, input.lastTripId])
    if (id && input.trips.includes(id)) return id;
  return input.trips.length === 1 ? input.trips[0] : null;
}

// A full page load, so nothing from the previous trip stays in memory.
export function openTrip(tripId: string): void {
  rememberTripId(tripId);
  window.location.href = `${BASE_PATH}/?trip=${encodeURIComponent(tripId)}`;
}

// Back to the user's own trips, from a link that didn't work out.
export function openMyTrips(): void {
  forgetTripId();
  window.location.href = `${BASE_PATH}/`;
}
