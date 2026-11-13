import { describe, expect, it } from "vitest";

import { distanceMeters, formatDistance, typeLabel } from "@/domain/nearby";

describe("nearby helpers", () => {
  it("measures metres between two points", () => {
    const a = { lat: 35.6812, lng: 139.7671 };
    const b = { lat: 35.6822, lng: 139.7671 };
    expect(distanceMeters(a, a)).toBe(0);
    expect(distanceMeters(a, b)).toBeGreaterThan(100);
    expect(distanceMeters(a, b)).toBeLessThan(125);
  });

  it("words a distance", () => {
    expect(formatDistance(3)).toBe("10 m");
    expect(formatDistance(124)).toBe("120 m");
    expect(formatDistance(1440)).toBe("1.4 km");
  });

  it("words a type", () => {
    expect(typeLabel("ramen_restaurant")).toBe("Ramen restaurant");
    expect(typeLabel(null)).toBeNull();
  });
});
