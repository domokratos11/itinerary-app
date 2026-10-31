import type { LatLng } from "@/lib/geo";

// Screens reach Google Maps only through this interface. The Google version
// is in src/lib; a memory version is used in tests. Nothing here may be
// written to Firestore except a place ID and coordinates (CLAUDE.md rule 4).

export type MapsErrorKind = "not-configured" | "offline" | "quota" | "failed";

export class MapsError extends Error {
  constructor(
    readonly kind: MapsErrorKind,
    message: string = kind,
  ) {
    super(message);
    this.name = "MapsError";
  }
}

export type MapPin = {
  id: string;
  position: LatLng;
  title: string;
  // Text inside the pin, such as the stop number.
  label: string | null;
  color: string;
  emphasised: boolean;
  // Tapping opens the place's details; hotels have none.
  clickable: boolean;
};

export type MapLine = {
  path: LatLng[];
  // A real walking route, or a straight line where there is none.
  kind: "walk" | "straight";
};

export type MapView = {
  update(pins: MapPin[], lines: MapLine[]): void;
  destroy(): void;
};

export type MapOptions = {
  colorScheme: "light" | "dark";
  onPinClick: (id: string) => void;
  // The key was refused after the map had already started.
  onFailure: (kind: MapsErrorKind) => void;
};

export type WalkingLeg = {
  minutes: number;
  meters: number;
  path: LatLng[];
};

export type PlacePhoto = {
  // Fetching this URL is what counts against the photo allowance, so it
  // should only be put in an image once that photo is actually shown.
  url: string;
  authorName: string | null;
  authorUrl: string | null;
  // The original on Google Maps, which must stay reachable.
  mapsUrl: string | null;
};

export type LivePlace = {
  openNow: boolean | null;
  rating: number | null;
  ratingCount: number | null;
  // Today's line from Google, such as "9:30 AM – 5:00 PM".
  todayHours: string | null;
  mapsUrl: string | null;
};

export type PlaceSuggestion = {
  placeId: string;
  name: string;
  detail: string | null;
};

export interface MapsService {
  isConfigured(): boolean;
  createMap(container: HTMLElement, options: MapOptions): Promise<MapView>;
  // Walking time and distance. Kept in memory for the session only.
  walkingLeg(from: LatLng, to: LatLng): Promise<WalkingLeg>;
  photos(placeId: string): Promise<PlacePhoto[]>;
  liveDetails(placeId: string, weekday: string): Promise<LivePlace>;
  suggestPlaces(input: string): Promise<PlaceSuggestion[]>;
  // Coordinates for a chosen suggestion, which also ends its billing session.
  locatePlace(placeId: string): Promise<LatLng & { placeId: string }>;
}
