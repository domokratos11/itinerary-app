import { distanceKm } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";

// Straight-line distance in whole metres.
export function distanceMeters(a: LatLng, b: LatLng): number {
  return Math.round(distanceKm(a, b) * 1000);
}

// "120 m" up to a kilometre, then "1.4 km".
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Google's type as words: "ramen_restaurant" becomes "Ramen restaurant".
// Google's own text stays in English (rule 13).
export function typeLabel(type: string | null): string | null {
  if (!type) return null;
  const words = type.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}
