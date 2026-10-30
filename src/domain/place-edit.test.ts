import { describe, expect, it } from "vitest";

import {
  formFromPlace,
  newPlaceRecord,
  placeFromForm,
  searchUrl,
} from "@/domain/place-edit";
import { PlaceRecordSchema } from "@/domain/schemas";

const base = {
  status: "researched" as const,
  source: "catalog" as const,
  verifiedAt: null,
  archived: false,
  updatedAt: "2026-11-01T00:00:00.000Z",
};

const form = () => formFromPlace(null);

describe("placeFromForm", () => {
  it("needs a name", () => {
    expect(placeFromForm(form(), base).ok).toBe(false);
  });

  it("falls back to a Maps search link and builds a valid record", () => {
    const result = placeFromForm(
      { ...form(), name: "Tsukiji Outer Market" },
      base,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.fields.mapsUrl).toBe(searchUrl("Tsukiji Outer Market"));
    const record = newPlaceRecord(result.fields, "tokyo", [
      "tsukiji-outer-market",
    ]);
    expect(record.id).toBe("tsukiji-outer-market-2");
    expect(PlaceRecordSchema.safeParse(record).success).toBe(true);
  });

  it("parses tips, dates, cost and duration", () => {
    const result = placeFromForm(
      {
        ...form(),
        name: "Shrine",
        tips: "Go early\n\n  Bring cash ",
        closedDates: "2027-01-02, 2026-12-31",
        cost: "500",
        durationMin: "45",
      },
      base,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.fields.tips).toEqual(["Go early", "Bring cash"]);
    expect(result.fields.closedDates).toEqual(["2026-12-31", "2027-01-02"]);
    expect(result.fields.costEstimateJPY).toBe(500);
    expect(result.fields.durationMin).toBe(45);
  });

  it.each([
    ["cost", { cost: "-1" }],
    ["cost", { cost: "1.5" }],
    ["duration", { durationMin: "0" }],
    ["date", { closedDates: "tomorrow" }],
    ["season order", { seasonFrom: "2027-01-05", seasonTo: "2027-01-01" }],
    ["website", { websiteUrl: "not a url" }],
  ])("rejects a bad %s", (_label, patch) => {
    expect(placeFromForm({ ...form(), name: "X", ...patch }, base).ok).toBe(
      false,
    );
  });

  it("round-trips an existing place", () => {
    const made = placeFromForm({ ...form(), name: "A", cost: "0" }, base);
    if (!made.ok) throw new Error(made.error);
    const original = newPlaceRecord(made.fields, "tokyo", []);
    const again = placeFromForm(formFromPlace(original), original);
    expect(again.ok && again.fields.costEstimateJPY).toBe(0);
  });
});
