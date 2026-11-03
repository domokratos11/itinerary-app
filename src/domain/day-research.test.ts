import { describe, expect, it } from "vitest";

import {
  dayBrief,
  dayPlaces,
  dayProposals,
  DayResultSchema,
  requestDay,
} from "./day-research";
import { newProposal } from "./proposals";
import type { DayAnalysis, DayResearch, PlanItem } from "./schemas";
import { testPlace } from "./test-place";

const NOW = new Date("2026-11-03T00:00:00.000Z");

const analysis: DayAnalysis = {
  load: "medium",
  loadReason: "Three stops, about 4 km apart.",
  summary: "A good day.",
  warnings: [],
  hints: [],
  answer: null,
  sources: [],
  researchedAt: NOW.toISOString(),
};

describe("requestDay", () => {
  it("keeps the last analysis while it waits", () => {
    const ready: DayResearch = {
      ...requestDay("2026-12-18", "", null, NOW),
      status: "ready",
      analysis,
    };
    const again = requestDay("2026-12-18", "  Winter lights?  ", ready, NOW);
    expect(again).toMatchObject({
      id: "2026-12-18",
      status: "requested",
      request: "Winter lights?",
      analysis,
    });
  });

  it("starts clean after a cancelled request", () => {
    const archived: DayResearch = {
      ...requestDay("2026-12-18", "", null, NOW),
      status: "archived",
      analysis,
    };
    const fresh = requestDay("2026-12-18", "", archived, NOW);
    expect(fresh.analysis).toBeNull();
    expect(fresh.request).toBeNull();
  });
});

describe("dayPlaces and dayProposals", () => {
  const a = testPlace({ id: "a", lat: 35.0, lng: 139.0 });
  const b = testPlace({ id: "b", lat: 35.0, lng: 139.1 });
  const gone = testPlace({ id: "gone", archived: true });
  const byId = new Map([a, b, gone].map((p) => [p.id, p]));
  const item = (
    id: string,
    placeId: string,
    order: string,
    status = "planned",
  ) => ({ id, placeId, date: "2026-12-18", order, status }) as PlanItem;
  const items = [
    item("2", "b", "a1"),
    item("1", "a", "a0"),
    item("3", "gone", "a2"),
    item("4", "a", "a3", "removed"),
  ];

  it("lists the day's live places in order", () => {
    expect(dayPlaces("2026-12-18", items, byId).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("finds the ready research of those places", () => {
    const ready = { ...newProposal("p1", "a", NOW), status: "ready" as const };
    const other = {
      ...newProposal("p2", "zzz", NOW),
      status: "ready" as const,
    };
    const waiting = newProposal("p3", "b", NOW);
    expect(dayProposals([ready, other, waiting], [a, b])).toEqual([ready]);
  });

  it("briefs a run with distances but no coordinates", () => {
    const brief = dayBrief({
      research: requestDay("2026-12-18", "Events?", null, NOW),
      weekday: "Friday",
      cities: ["Tokyo"],
      hotel: "Sample Hotel",
      holiday: null,
      reservations: [],
      flights: [],
      stops: [a, b],
      proposalIds: new Map([["a", "p1"]]),
    });
    expect(brief.kmBetweenStops).toEqual([9.1]);
    expect(brief.stops[0]).toMatchObject({ placeId: "a", proposalId: "p1" });
    expect(JSON.stringify(brief)).not.toContain("139.1");
  });
});

describe("DayResultSchema", () => {
  it("accepts an analysis without its time and refuses a bad load", () => {
    const rest = { ...analysis, researchedAt: undefined };
    expect(
      DayResultSchema.safeParse({ date: "2026-12-18", analysis: rest }).success,
    ).toBe(true);
    expect(
      DayResultSchema.safeParse({
        date: "2026-12-18",
        analysis: { ...rest, load: "brutal" },
      }).success,
    ).toBe(false);
  });
});
