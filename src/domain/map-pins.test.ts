import { describe, expect, it } from "vitest";

import { cityPins, dayMap, straightLines } from "./map-pins";
import type { Place, PlanItem } from "./schemas";

const place = (id: string, lat: number | null, overrides = {}): Place =>
  ({
    id,
    name: id,
    lat,
    lng: lat === null ? null : 139.7,
    category: "sight",
    priority: "want",
    ...overrides,
  }) as Place;

const item = (status: PlanItem["status"] = "planned") =>
  ({ status }) as PlanItem;

const hotel = (lat: number, name = "Hotel") => ({
  name,
  location: { lat, lng: 139.7 },
});

describe("cityPins", () => {
  it("skips places without coordinates and emphasises must-sees", () => {
    const pins = cityPins([
      place("a", 35),
      place("b", null),
      place("c", 36, { priority: "must" }),
    ]);
    expect(pins.map((p) => p.id)).toEqual(["a", "c"]);
    expect(pins[1].emphasised).toBe(true);
  });
});

describe("dayMap", () => {
  it("numbers stops by their place in the day and shows one hotel pin", () => {
    const stops = [
      { item: item(), place: place("a", 35) },
      { item: item(), place: place("b", null) },
      { item: item(), place: place("c", 36) },
    ];
    const day = dayMap(stops, hotel(34), hotel(34));
    expect(day.pins.map((p) => p.label)).toEqual(["H", "1", "3"]);
    expect(day.unpinned).toBe(1);
    expect(day.route).toHaveLength(4);
  });

  it("shows two hotels on a transfer day", () => {
    const day = dayMap([], hotel(34, "Old"), hotel(35, "New"));
    expect(day.pins.map((p) => p.title)).toEqual(["Old", "New"]);
  });

  it("copes with a hotel that only has a text location", () => {
    const start = { name: "Hotel", location: { query: "Hotel Japan" } };
    const day = dayMap([{ item: item(), place: place("a", 35) }], start, start);
    expect(day.pins.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("straightLines", () => {
  it("connects each point to the next", () => {
    const a = { lat: 1, lng: 1 };
    const b = { lat: 2, lng: 2 };
    const c = { lat: 3, lng: 3 };
    expect(straightLines([a, b, c]).map((l) => l.path)).toEqual([
      [a, b],
      [b, c],
    ]);
  });
});
