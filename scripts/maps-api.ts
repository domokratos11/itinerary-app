/**
 * Places API (New) calls for the Node scripts, using the script key from the
 * git-ignored .env. Only IDs and coordinates are asked for: IDs are free, and
 * nothing else from Google may be stored (CLAUDE.md rule 4).
 */
const PLACES = "https://places.googleapis.com/v1/places";

export function loadEnv(): void {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: the values may be set in the shell instead.
  }
}

export function scriptKey(): string {
  const key = process.env.GOOGLE_MAPS_SCRIPT_KEY;
  if (!key) {
    console.error(
      "Set GOOGLE_MAPS_SCRIPT_KEY in .env. See docs/maps-setup.md.",
    );
    process.exit(1);
  }
  return key;
}

async function failure(response: Response): Promise<Error> {
  return new Error(`Places API ${response.status}: ${await response.text()}`);
}

// Text Search, IDs only: free and unlimited. The first result, or null.
export async function searchPlaceId(
  key: string,
  textQuery: string,
): Promise<string | null> {
  const response = await fetch(`${PLACES}:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery, regionCode: "JP", languageCode: "en" }),
  });
  if (!response.ok) throw await failure(response);
  const { places } = (await response.json()) as { places?: { id: string }[] };
  return places?.[0]?.id ?? null;
}

export type FetchedLocation = { id: string; lat: number; lng: number };

// Place Details Essentials. Null when Google no longer knows the place. The
// returned ID can differ from the one asked for: place IDs change over time.
export async function fetchLocation(
  key: string,
  placeId: string,
): Promise<FetchedLocation | null> {
  const response = await fetch(`${PLACES}/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,location" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await failure(response);
  const place = (await response.json()) as {
    id: string;
    location?: { latitude: number; longitude: number };
  };
  if (!place.location) return null;
  return {
    id: place.id,
    lat: place.location.latitude,
    lng: place.location.longitude,
  };
}

// Keeps a long run well under the per-minute limits.
export function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150));
}
