import { describe, expect, it } from "vitest";

import { readResults } from "./food-research-push";
import { sampleSpot } from "../src/test/sample-food";

describe("readResults", () => {
  it("joins a city's spots from several files", () => {
    const a = JSON.stringify([{ cityId: "nagoya", spots: [sampleSpot()] }]);
    const b = JSON.stringify([
      { cityId: "nagoya", spots: [sampleSpot({ name: "Two" })] },
      { cityId: "kobe", spots: [] },
    ]);
    const results = readResults([a, b]);
    expect(results.map((r) => [r.cityId, r.spots.length])).toEqual([
      ["nagoya", 2],
      ["kobe", 0],
    ]);
  });

  it("refuses an unknown field", () => {
    const bad = JSON.stringify([
      { cityId: "nagoya", spots: [{ ...sampleSpot(), rating: 4.5 }] },
    ]);
    expect(() => readResults([bad])).toThrow();
  });

  it("refuses a spot without a source", () => {
    const bad = JSON.stringify([
      { cityId: "nagoya", spots: [sampleSpot({ sources: [] })] },
    ]);
    expect(() => readResults([bad])).toThrow();
  });
});
