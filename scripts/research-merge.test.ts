import { describe, expect, it } from "vitest";

import type { Place } from "../src/domain/schemas";
import { mergeResult, today, type Result } from "./research-merge";

const place: Place = {
  id: "p",
  cityId: "nagoya",
  mapsUrl: "https://example.com/m",
  name: "Park",
  lat: null,
  lng: null,
  category: "sight",
  purpose: null,
  description: null,
  tips: [],
  costEstimateJPY: null,
  durationMin: 60,
  openingHours: null,
  closedDates: [],
  seasonFrom: null,
  seasonTo: null,
  priority: "must",
  verifiedAt: null,
  websiteUrl: null,
  notes: "Go early",
};

const result = (patch: Partial<Result>): Result => ({
  id: "p",
  sources: ["https://example.com/official"],
  confidence: "high",
  ...patch,
});

describe("mergeResult", () => {
  it("ignores a result with no source", () => {
    const out = mergeResult(
      place,
      result({ sources: [], costEstimateJPY: 500 }),
      "2026-10-30",
    );
    expect(out).toBe(place);
  });

  it("fills facts, keeps priority and existing values, and cites sources", () => {
    const out = mergeResult(
      place,
      result({ costEstimateJPY: 0, durationMin: null, openingHours: "9-17" }),
      "2026-10-30",
    );
    expect(out.costEstimateJPY).toBe(0);
    expect(out.durationMin).toBe(60);
    expect(out.openingHours).toBe("9-17");
    expect(out.priority).toBe("must");
    expect(out.verifiedAt).toBe("2026-10-30");
    expect(out.notes).toBe("Go early Sources: https://example.com/official");
  });

  it("replaces earlier sources instead of stacking them and flags low confidence", () => {
    const first = mergeResult(place, result({}), "2026-10-30");
    const again = mergeResult(
      first,
      result({ confidence: "low" }),
      "2026-10-31",
    );
    expect(again.notes).toBe(
      "Go early Sources: https://example.com/official (low confidence)",
    );
  });

  it("takes coordinates only as a pair", () => {
    expect(mergeResult(place, result({ lat: 35 }), "d").lat).toBeNull();
    expect(mergeResult(place, result({ lat: 35, lng: 136 }), "d").lng).toBe(
      136,
    );
  });
});

describe("today", () => {
  it("uses Tokyo time", () => {
    expect(today(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });
});
