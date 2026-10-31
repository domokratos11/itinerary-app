import { describe, expect, it } from "vitest";

import { seed } from "@/lib/catalog";
import {
  acceptProposal,
  cleanResearch,
  isOpenProposal,
  newProposal,
  proposalRows,
  ResearchResultSchema,
} from "./proposals";
import { ProposalSchema, type PlaceRecord } from "./schemas";

const now = new Date("2026-11-20T00:00:00.000Z");
const place: PlaceRecord = {
  ...seed.places[0],
  status: "draft",
  costEstimateJPY: null,
  durationMin: 60,
  openingHours: "9:00-17:00",
  notes: "Mine",
  lockedFields: ["notes"],
  sources: [{ field: "openingHours", url: "https://old.example.com" }],
};
const source = (field: string) => ({
  field,
  url: `https://example.com/${field}`,
});

describe("newProposal", () => {
  it("makes a valid open request", () => {
    const proposal = newProposal("abc", place.id, now);
    expect(ProposalSchema.safeParse(proposal).success).toBe(true);
    expect(isOpenProposal(proposal)).toBe(true);
    expect(isOpenProposal({ status: "applied" })).toBe(false);
  });
});

describe("proposalRows", () => {
  it("separates fills from changes and skips what doesn't apply", () => {
    const rows = proposalRows(place, {
      fields: {
        costEstimateJPY: 600,
        openingHours: "9:30-17:00",
        durationMin: 60,
        notes: "From research",
      },
      sources: [source("costEstimateJPY"), source("openingHours")],
    });
    expect(rows.map((r) => [r.field, r.kind])).toEqual([
      ["costEstimateJPY", "fill"],
      ["openingHours", "change"],
    ]);
    expect(rows[0]).toMatchObject({ before: "Empty", after: "¥600" });
    expect(rows[1].sources).toEqual(["https://example.com/openingHours"]);
  });
});

describe("acceptProposal", () => {
  const proposal = {
    fields: { costEstimateJPY: 600, openingHours: "9:30-17:00" },
    sources: [source("costEstimateJPY"), source("openingHours")],
  };

  it("applies only the chosen fields, with their sources", () => {
    const after = acceptProposal(
      place,
      proposal,
      new Set(["costEstimateJPY"]),
      now,
    );
    expect(after.costEstimateJPY).toBe(600);
    expect(after.openingHours).toBe("9:00-17:00");
    expect(after.status).toBe("researched");
    expect(after.sources.map((s) => s.field)).toEqual([
      "openingHours",
      "costEstimateJPY",
    ]);
    expect(after.sources[0].url).toBe("https://old.example.com");
  });

  it("replaces the source of a corrected field", () => {
    const after = acceptProposal(
      place,
      proposal,
      new Set(["openingHours"]),
      now,
    );
    expect(after.sources).toEqual([source("openingHours")]);
  });

  it("never writes a locked field", () => {
    const after = acceptProposal(
      place,
      { fields: { notes: "From research" }, sources: [source("notes")] },
      new Set(["notes"]),
      now,
    );
    expect(after.notes).toBe("Mine");
    expect(after.status).toBe("draft");
  });
});

describe("cleanResearch", () => {
  it("drops locked, sourceless and unknown values, and reports them", () => {
    const { fields, sources, dropped } = cleanResearch(place, {
      fields: {
        costEstimateJPY: 600,
        description: "A zoo",
        notes: "From research",
        websiteUrl: null,
        verifiedAt: "2026-11-20",
      },
      sources: [source("costEstimateJPY"), source("notes"), source("seasonTo")],
    });
    expect(fields).toEqual({ costEstimateJPY: 600, verifiedAt: "2026-11-20" });
    expect(sources).toEqual([source("costEstimateJPY")]);
    expect(dropped).toEqual([
      "description: no source",
      "notes: locked by a hand edit",
    ]);
  });
});

describe("ResearchResultSchema", () => {
  it("accepts only https links", () => {
    const result = (url: string) =>
      ResearchResultSchema.safeParse({
        proposalId: "a",
        fields: {},
        sources: [{ field: "description", url }],
      }).success;
    expect(result("https://example.com")).toBe(true);
    expect(result("http://example.com")).toBe(false);
    expect(result("javascript:alert(1)")).toBe(false);
  });
});
