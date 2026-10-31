import { describe, expect, it } from "vitest";

import { planCleanup, planEverything, type CleanupInput } from "./cleanup";
import type { PlanItem, Proposal } from "./schemas";
import { testPlace } from "./test-place";
import { EMPTY_TRIP } from "./trip";
import { fixtureTrip } from "@/test/fixture-trip";

const stop = (id: string, placeId: string, status: PlanItem["status"]) =>
  ({ id, placeId, status }) as PlanItem;
const proposal = (id: string, placeId: string, status: Proposal["status"]) =>
  ({ id, placeId, status }) as Proposal;
const input = (over: Partial<CleanupInput> = {}): CleanupInput => ({
  trip: EMPTY_TRIP,
  items: [],
  proposals: [],
  ...over,
});
const old = testPlace({ id: "old", archived: true });
const live = testPlace({ id: "live" });

describe("planCleanup", () => {
  it("takes only archived rows", () => {
    const kept = { ...fixtureTrip.holidays[0], id: "kept", archived: false };
    const retired = { ...kept, id: "retired", archived: true };
    const plan = planCleanup(
      "holidays",
      input({ trip: { ...EMPTY_TRIP, holidays: [kept, retired] } }),
    );
    expect(plan).toEqual({
      remove: { holidays: ["retired"] },
      count: 1,
      skipped: 0,
    });
  });

  it("keeps an archived place a stop still uses", () => {
    const plan = planCleanup(
      "places",
      input({
        trip: { ...EMPTY_TRIP, places: [old, live] },
        items: [stop("s1", "old", "planned")],
      }),
    );
    expect(plan.remove.places).toEqual([]);
    expect(plan.skipped).toBe(1);
  });

  it("keeps an archived place with research still open", () => {
    const plan = planCleanup(
      "places",
      input({
        trip: { ...EMPTY_TRIP, places: [old] },
        proposals: [proposal("p1", "old", "ready")],
      }),
    );
    expect(plan.count).toBe(0);
    expect(plan.skipped).toBe(1);
  });

  it("takes a place's removed stops and finished research along", () => {
    const plan = planCleanup(
      "places",
      input({
        trip: { ...EMPTY_TRIP, places: [old, live] },
        items: [stop("s1", "old", "removed"), stop("s2", "live", "planned")],
        proposals: [
          proposal("p1", "old", "dismissed"),
          proposal("p2", "live", "applied"),
        ],
      }),
    );
    expect(plan.remove).toEqual({
      places: ["old"],
      items: ["s1"],
      proposals: ["p1"],
    });
    expect(plan.count).toBe(1);
  });

  it("keeps an archived city with a live place or hotel", () => {
    const city = (id: string) => ({
      id,
      name: id,
      color: "#000000",
      archived: true,
      updatedAt: "2026-11-01T00:00:00.000Z",
    });
    const plan = planCleanup(
      "cities",
      input({
        trip: {
          ...EMPTY_TRIP,
          cities: [city("tokyo-ueno"), city("empty")],
          places: [live],
        },
      }),
    );
    expect(plan.remove.cities).toEqual(["empty"]);
    expect(plan.skipped).toBe(1);
  });

  it("takes only removed stops and finished research", () => {
    const data = input({
      items: [stop("a", "x", "removed"), stop("b", "x", "skipped")],
      proposals: [
        proposal("c", "x", "applied"),
        proposal("d", "x", "requested"),
      ],
    });
    expect(planCleanup("stops", data).remove.items).toEqual(["a"]);
    expect(planCleanup("research", data).remove.proposals).toEqual(["c"]);
  });
});

describe("planEverything", () => {
  it("lists a row reached two ways once", () => {
    const plan = planEverything(
      input({
        trip: { ...EMPTY_TRIP, places: [old] },
        items: [stop("s1", "old", "removed")],
        proposals: [proposal("p1", "old", "applied")],
      }),
    );
    expect(plan.remove.items).toEqual(["s1"]);
    expect(plan.remove.proposals).toEqual(["p1"]);
    expect(plan.count).toBe(3);
  });

  it("has nothing to do on a tidy trip", () => {
    expect(planEverything(input({ trip: fixtureTrip })).count).toBe(0);
  });
});
