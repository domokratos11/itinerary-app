import type { Category, Place, Priority } from "@/domain/schemas";
import { distanceKm } from "@/lib/geo";

export type CatalogFilter = {
  category: Category | "all";
  priority: Priority | "all";
  unassignedOnly: boolean;
};

export const NEARBY_KM = 1;

// A place is "unassigned" when no active plan item uses it, meaning it
// doesn't fit any day yet.
export function filterPlaces(
  places: Place[],
  filter: CatalogFilter,
  assignedPlaceIds: ReadonlySet<string>,
): Place[] {
  return places.filter((p) => {
    if (filter.category !== "all" && p.category !== filter.category)
      return false;
    if (filter.priority !== "all" && p.priority !== filter.priority)
      return false;
    if (filter.unassignedOnly && assignedPlaceIds.has(p.id)) return false;
    return true;
  });
}

// Other catalog places within NEARBY_KM, using saved coordinates. Places
// without coordinates have no neighbours. Computed at build time.
export function nearbyByPlace(places: Place[]): Record<string, Place[]> {
  const result: Record<string, Place[]> = {};
  for (const p of places) {
    const origin =
      p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : null;
    result[p.id] = origin
      ? places.filter((other) => {
          if (other.id === p.id || other.lat === null || other.lng === null)
            return false;
          const at = { lat: other.lat, lng: other.lng };
          return distanceKm(origin, at) <= NEARBY_KM;
        })
      : [];
  }
  return result;
}
