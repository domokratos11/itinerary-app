import { describe, expect, it, vi } from "vitest";

import { itemsForDay } from "@/domain/plan";
import type { PlanItem } from "@/domain/schemas";
import { LocalPlanRepository } from "@/lib/local-plan-repository";

const repo = new LocalPlanRepository();
vi.mock("@/lib/plan-repository-instance", () => ({
  get planRepository() {
    return repo;
  },
}));

const { addPlaceToDay, placeItem, removeItem, restoreItem } =
  await import("@/lib/plan-actions");

const TRIP = "trip-1";
const DAY = "2026-12-18";

function snapshot(): PlanItem[] {
  let items: PlanItem[] = [];
  repo.subscribe(TRIP, (list) => (items = list))();
  return items;
}

const day = () => itemsForDay(snapshot(), DAY);

describe("placeItem", () => {
  it("reorders a day after Undo brought back a stop with a reused key", async () => {
    for (const placeId of ["p1", "p2", "p3"]) {
      await addPlaceToDay(TRIP, placeId, DAY, day());
    }
    // Remove the last stop, add another (it takes the freed key), then Undo.
    const third = day()[2];
    await removeItem(TRIP, third);
    await addPlaceToDay(TRIP, "p4", DAY, day());
    await restoreItem(TRIP, third);
    expect(new Set(day().map((i) => i.order)).size).toBe(3);

    // Move the first stop between the two that share a key.
    const first = day()[0];
    const others = day().filter((i) => i.id !== first.id);
    await placeItem(TRIP, first, DAY, 2, others);

    const order = day().map((i) => i.placeId);
    expect(order[0]).toBe("p2");
    expect(order[2]).toBe("p1");
    expect(new Set(day().map((i) => i.order)).size).toBe(4);
  });
});
