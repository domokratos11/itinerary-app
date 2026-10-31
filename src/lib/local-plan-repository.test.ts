import { beforeEach, describe, expect, it } from "vitest";

import { markRemoved } from "@/domain/plan-repository";
import type { PlanItem } from "@/domain/schemas";
import { LocalPlanRepository } from "@/lib/local-plan-repository";

const item = (overrides: Partial<PlanItem> = {}): PlanItem => ({
  id: "item-1",
  placeId: "n-oasis21",
  date: "2026-12-25",
  order: "a0",
  startTime: null,
  durationMin: null,
  note: null,
  status: "planned",
  legNote: null,
  updatedAt: "2026-10-28T12:00:00.000Z",
  ...overrides,
});

describe("LocalPlanRepository", () => {
  let repo: LocalPlanRepository;

  beforeEach(() => {
    repo = new LocalPlanRepository();
  });

  it("sends the current list to a new subscriber", () => {
    const seen: PlanItem[][] = [];
    repo.subscribe("trip-abc123", (items) => seen.push(items));
    expect(seen).toEqual([[]]);
  });

  it("notifies subscribers after a save", async () => {
    const seen: PlanItem[][] = [];
    repo.subscribe("trip-abc123", (items) => seen.push(items));
    await repo.save("trip-abc123", item());
    expect(seen.at(-1)).toEqual([item()]);
  });

  it("replaces an item with the same id instead of duplicating it", async () => {
    const seen: PlanItem[][] = [];
    repo.subscribe("trip-abc123", (items) => seen.push(items));
    await repo.save("trip-abc123", item({ order: "a0" }));
    await repo.save("trip-abc123", item({ order: "a1" }));
    expect(seen.at(-1)).toHaveLength(1);
    expect(seen.at(-1)?.[0].order).toBe("a1");
  });

  it("keeps trips separate", async () => {
    const seen: PlanItem[][] = [];
    repo.subscribe("trip-other", (items) => seen.push(items));
    await repo.save("trip-abc123", item());
    expect(seen.at(-1)).toEqual([]);
  });

  it("stops notifying after unsubscribe", async () => {
    const seen: PlanItem[][] = [];
    const stop = repo.subscribe("trip-abc123", (items) => seen.push(items));
    stop();
    await repo.save("trip-abc123", item());
    expect(seen).toHaveLength(1);
  });

  it("soft-deletes by marking the item removed and keeping it", async () => {
    const seen: PlanItem[][] = [];
    repo.subscribe("trip-abc123", (items) => seen.push(items));
    await repo.save("trip-abc123", item());
    await repo.save(
      "trip-abc123",
      markRemoved(item(), new Date("2026-12-25T10:00:00.000Z")),
    );
    const latest = seen.at(-1) ?? [];
    expect(latest).toHaveLength(1);
    expect(latest[0].status).toBe("removed");
    expect(latest[0].updatedAt).toBe("2026-12-25T10:00:00.000Z");
  });
});
