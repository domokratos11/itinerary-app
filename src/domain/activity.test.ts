import { describe, expect, it } from "vitest";

import { undoFor, type Activity } from "@/domain/activity";
import type { PlanItem } from "@/domain/schemas";

const NOW = new Date("2026-11-02T00:00:00.000Z");

const item = (overrides: Partial<PlanItem>): PlanItem => ({
  id: "i1",
  placeId: "p",
  date: "2026-12-25",
  order: "a0",
  startTime: null,
  durationMin: null,
  note: null,
  status: "planned",
  legNote: null,
  updatedAt: "2026-11-01T10:00:00.000Z",
  ...overrides,
});

const entry = (before: PlanItem | null, after: PlanItem | null): Activity => ({
  id: "e1",
  at: "2026-11-01T10:00:00.000Z",
  device: "Rey's phone",
  kind: "moved",
  targetId: "i1",
  summary: "moved p",
  before: before && JSON.stringify(before),
  after: after && JSON.stringify(after),
});

describe("undoFor", () => {
  const before = item({ date: "2026-12-25" });
  const after = item({
    date: "2026-12-26",
    updatedAt: "2026-11-01T11:00:00.000Z",
  });

  it("puts the stop back as it was before the change", () => {
    expect(undoFor(entry(before, after), after, NOW)).toEqual({
      ...before,
      updatedAt: NOW.toISOString(),
    });
  });

  it("can't undo once the stop has changed again", () => {
    const later = { ...after, updatedAt: "2026-11-01T12:00:00.000Z" };
    expect(undoFor(entry(before, after), later, NOW)).toBeNull();
  });

  it("removes a stop when undoing its adding", () => {
    expect(undoFor(entry(null, after), after, NOW)?.status).toBe("removed");
  });

  it("can't undo changes that aren't to a stop", () => {
    expect(undoFor(entry(null, null), after, NOW)).toBeNull();
    expect(undoFor(entry(before, after), undefined, NOW)).toBeNull();
  });
});
