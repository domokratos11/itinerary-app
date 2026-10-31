import { describe, expect, it, vi } from "vitest";

import { makeBackup } from "@/domain/backup";
import { testPlace } from "@/domain/test-place";
import { fixtureTrip } from "@/test/fixture-trip";
import { LocalPlanRepository } from "@/lib/local-plan-repository";
import { LocalProposalRepository } from "@/lib/local-proposal-repository";
import { LocalTripRepository } from "@/lib/local-trip-repository";

const plans = new LocalPlanRepository();
const trips = new LocalTripRepository();
const proposals = new LocalProposalRepository();
vi.mock("@/lib/proposal-repository-instance", () => ({
  get proposalRepository() {
    return proposals;
  },
}));
vi.mock("@/lib/plan-repository-instance", () => ({
  get planRepository() {
    return plans;
  },
}));
vi.mock("@/lib/trip-repository-instance", () => ({
  get tripRepository() {
    return trips;
  },
}));

const { importBackup } = await import("@/lib/backup-actions");

describe("importBackup", () => {
  it("writes every collection and the plan into the trip", async () => {
    const place = testPlace();
    const item = {
      id: "i1",
      placeId: place.id,
      date: "2026-12-18",
      order: "a0",
      startTime: null,
      durationMin: null,
      note: null,
      status: "planned" as const,
      legNote: null,
      updatedAt: "2026-11-01T00:00:00.000Z",
    };
    await importBackup(
      "trip-2",
      makeBackup(
        { ...fixtureTrip, places: [place] },
        [item],
        new Date("2026-11-02T00:00:00Z"),
      ),
    );

    const counts: Record<string, number> = {};
    trips.subscribe("trip-2", (name, records) => {
      counts[name] = records.length;
    })();
    expect(counts).toEqual({
      cities: fixtureTrip.cities.length,
      stays: fixtureTrip.stays.length,
      reservations: fixtureTrip.reservations.length,
      places: 1,
      holidays: fixtureTrip.holidays.length,
      expenses: 0,
    });

    let planned: unknown[] = [];
    plans.subscribe("trip-2", (items) => (planned = items))();
    expect(planned).toEqual([item]);
  });
});
