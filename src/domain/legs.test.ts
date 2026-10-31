import { describe, expect, it } from "vitest";

import {
  dayLegs,
  formatDistance,
  formatLegNote,
  formatStation,
  formatWalk,
} from "./legs";
import type { Place, PlanItem } from "./schemas";

const place = (id: string, lat: number | null, lng = 139.77) =>
  ({ id, name: id, lat, lng: lat === null ? null : lng }) as Place;
const row = (id: string, at: Place | undefined, legNote = null) => ({
  item: { id, legNote } as PlanItem,
  place: at,
});
const hotel = { name: "Hotel", location: { lat: 35.71, lng: 139.77 } };

describe("dayLegs", () => {
  it("is empty without stops", () => {
    expect(dayLegs([], hotel, hotel)).toEqual([]);
  });

  it("goes from the hotel, through the stops, and back", () => {
    const legs = dayLegs(
      [row("a", place("a", 35.712)), row("b", place("b", 35.75))],
      hotel,
      hotel,
    );
    expect(legs.map((l) => [l.key, l.kind])).toEqual([
      ["a", "walk"],
      ["b", "far"],
      ["end", "far"],
    ]);
  });

  it("uses walking directions for short legs and transit for long ones", () => {
    const [near, far] = dayLegs(
      [row("a", place("a", 35.712)), row("b", place("b", 35.75))],
      hotel,
      hotel,
    );
    expect(near.directions).toContain("travelmode=walking");
    expect(far.directions).toContain("travelmode=transit");
  });

  it("has no distance when a stop has no coordinates, but still has a link", () => {
    const [leg] = dayLegs([row("a", place("a", null))], hotel, hotel);
    expect(leg.kind).toBe("unknown");
    expect(leg.km).toBeNull();
    expect(leg.directions).toContain("destination=a%20Japan");
  });

  it("has no link when the hotel isn't decided", () => {
    const undecided = { name: "Hotel to be decided", location: null };
    const [leg] = dayLegs([row("a", place("a", 35))], undecided, undecided);
    expect(leg.directions).toBeNull();
  });
});

describe("formatting", () => {
  it("rounds distances", () => {
    expect(formatDistance(0.87)).toBe("About 900 m");
    expect(formatDistance(4.04)).toBe("About 4 km");
    expect(formatDistance(1.62)).toBe("About 1.6 km");
    expect(formatDistance(12.6)).toBe("About 13 km");
  });

  it("describes a walk", () => {
    expect(formatWalk(12, 900)).toBe("Walk 12 min · 900 m");
  });

  it("leaves out what a note doesn't have", () => {
    expect(
      formatLegNote({
        mode: "subway",
        minutes: 12,
        fareJPY: 180,
        text: "Ginza Line",
      }),
    ).toBe("Subway · about 12 min · ¥180 · Ginza Line");
    expect(
      formatLegNote({ mode: "taxi", minutes: null, fareJPY: null, text: null }),
    ).toBe("Taxi");
  });

  it("describes a station", () => {
    expect(
      formatStation({
        name: "Ueno Station",
        lines: ["Ginza Line"],
        walkMin: 4,
      }),
    ).toBe("Ueno Station, Ginza Line, 4 min walk");
  });
});
