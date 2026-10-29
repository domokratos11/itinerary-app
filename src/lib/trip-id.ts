// The trip ID is the Firestore document ID, so it is kept to safe characters.
// It lives in the shared link and in this browser's localStorage, never in
// the repo.
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
    // Not remembered; the ?trip= link still works.
  }
}

export function recallTripId(): string | null {
  try {
    return parseTripId(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

// A trip in the link wins and is remembered; otherwise use the remembered one.
export function resolveTripId(fromUrl: string | null): string | null {
  const id = parseTripId(fromUrl);
  if (id) {
    rememberTripId(id);
    return id;
  }
  return recallTripId();
}
