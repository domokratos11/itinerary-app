import { describe, expect, it } from "vitest";

import { typicalWeather, weatherKind, yearsBefore } from "./weather";

describe("weatherKind", () => {
  it.each([
    [0, "clear"],
    [2, "partly"],
    [3, "cloudy"],
    [45, "fog"],
    [53, "drizzle"],
    [63, "rain"],
    [81, "rain"],
    [73, "snow"],
    [86, "snow"],
    [95, "storm"],
  ])("reads code %i as %s", (code, kind) => {
    expect(weatherKind(code)).toBe(kind);
  });
});

describe("typicalWeather", () => {
  it("averages past years and counts wet ones", () => {
    expect(
      typicalWeather([
        { code: 0, maxC: 10, minC: 2, precipMm: 0 },
        { code: 1, maxC: 12, minC: 3, precipMm: 4 },
        { code: 0, maxC: 11, minC: 1, precipMm: 0.2 },
      ]),
    ).toEqual({
      kind: "clear",
      maxC: 11,
      minC: 2,
      precipPct: 33,
      source: "typical",
    });
  });

  it("is unknown with no past years", () => {
    expect(typicalWeather([])).toBeNull();
  });
});

describe("yearsBefore", () => {
  it("keeps the calendar date", () => {
    expect(yearsBefore("2027-01-02", 3)).toBe("2024-01-02");
  });
});
