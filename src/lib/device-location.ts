import type { LatLng } from "@/lib/geo";

export type LocationFailure =
  "denied" | "unavailable" | "timeout" | "unsupported";

export class LocationError extends Error {
  constructor(readonly reason: LocationFailure) {
    super(reason);
    this.name = "LocationError";
  }
}

// Where the phone is right now. The position is used for one search and never
// kept: not in the stores, not in Firestore.
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new LocationError("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) =>
        reject(
          new LocationError(
            error.code === 1
              ? "denied"
              : error.code === 3
                ? "timeout"
                : "unavailable",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
