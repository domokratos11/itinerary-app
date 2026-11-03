import { describe, expect, it } from "vitest";

import { ResultsFileSchema } from "./research-push";

const day = {
  date: "2026-12-18",
  analysis: {
    load: "light",
    loadReason: "Two stops next to each other.",
    summary: "An easy day.",
    warnings: [],
    hints: [],
    answer: null,
    sources: [],
  },
};

describe("ResultsFileSchema", () => {
  it("still reads a plain list of place results", () => {
    expect(ResultsFileSchema.parse([])).toEqual({ places: [], days: [] });
  });

  it("reads places and days together", () => {
    const file = ResultsFileSchema.parse({ days: [day] });
    expect(file.places).toEqual([]);
    expect(file.days[0].analysis.load).toBe("light");
  });

  it("refuses a day analysis without its summary", () => {
    const analysis = { ...day.analysis, summary: undefined };
    expect(
      ResultsFileSchema.safeParse({ days: [{ ...day, analysis }] }).success,
    ).toBe(false);
  });
});
