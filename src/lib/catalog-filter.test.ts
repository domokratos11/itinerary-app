import { describe, expect, it } from "vitest";

import type { Place } from "@/domain/schemas";
import { filterPlaces, nearbyByPlace } from "@/lib/catalog-filter";
import { todayInTokyo } from "@/lib/tokyo-date";

const place = (overrides: Partial<Place>): Place => ({
  id: "p",
  cityId: "nagoya",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=x",
  name: "Place",
  lat: null,
  lng: null,
  category: "sight",
  purpose: null,
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
  ...overrides,
});

const all: Filter = { category: "all", priority: "all", unassignedOnly: false };
type Filter = Parameters<typeof filterPlaces>[1];

describe("filterPlaces", () => {
  const places = [
    place({ id: "a", category: "food", priority: "must" }),
    place({ id: "b", category: "sight", priority: "want" }),
    place({ id: "c", category: "food", priority: "want" }),
  ];

  it("returns everything with no filters", () => {
    expect(filterPlaces(places, all, new Set())).toHaveLength(3);
  });

  it("filters by category and priority together", () => {
    const result = filterPlaces(
      places,
      { ...all, category: "food", priority: "want" },
      new Set(),
    );
    expect(result.map((p) => p.id)).toEqual(["c"]);
  });

  it("hides assigned places when unassigned only is on", () => {
    const result = filterPlaces(
      places,
      { ...all, unassignedOnly: true },
      new Set(["a"]),
    );
    expect(result.map((p) => p.id)).toEqual(["b", "c"]);
  });
});

describe("nearbyByPlace", () => {
  it("lists places within 1 km and leaves out distant ones", () => {
    const near = place({ id: "near", lat: 35.1709, lng: 136.9084 });
    const origin = place({ id: "origin", lat: 35.1709, lng: 136.9085 });
    const far = place({ id: "far", lat: 35.2, lng: 137.0 });
    const result = nearbyByPlace([origin, near, far]);
    expect(result.origin.map((p) => p.id)).toEqual(["near"]);
  });

  it("gives no neighbours to a place without coordinates", () => {
    const result = nearbyByPlace([place({ id: "x" })]);
    expect(result.x).toEqual([]);
  });
});

describe("todayInTokyo", () => {
  it("uses the Tokyo calendar date, not the local one", () => {
    // 2026-12-16 20:00 UTC is already 2026-12-17 05:00 in Tokyo.
    expect(todayInTokyo(new Date("2026-12-16T20:00:00Z"))).toBe("2026-12-17");
  });
});
