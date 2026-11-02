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

const { collectBackup, importBackup } = await import("@/lib/backup-actions");

vi.mock("@/lib/firestore-cleanup-repository", () => ({
  cleanupRepository: { queueLinks: async () => [{ id: "q" }] },
}));

describe("collectBackup", () => {
  it("adds the trip's details, history and old queue links", async () => {
    const { activityRepository } =
      await import("@/lib/activity-repository-instance");
    const entry = {
      id: "a1",
      at: "2026-11-01T00:00:00.000Z",
      device: "Phone",
      kind: "settings" as const,
      targetId: null,
      summary: "Saved",
      before: null,
      after: null,
    };
    await activityRepository.add("trip-1", entry);
    const budget = { totalJPY: 1000, byCategory: {}, travellers: 2 };
    const backup = await collectBackup(
      "trip-1",
      { id: "trip-1", name: "Peru", members: ["ana@example.com"], budget },
      fixtureTrip,
      [],
      [],
    );
    expect(backup.trip).toEqual({
      name: "Peru",
      members: ["ana@example.com"],
      budget,
    });
    expect(backup.activity).toEqual([entry]);
    expect(backup.queue).toEqual([{ id: "q" }]);

    await importBackup("trip-3", backup);
    expect(await activityRepository.all("trip-3")).toContainEqual(entry);
  });
});

describe("importBackup", () => {
  it("writes every collection and the plan into the trip", async () => {
    const place = testPlace();
    const item = {
      id: "i1",
      placeId: place.id,
      date: "2026-12-18",
      order: "a0",
      status: "planned" as const,
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
