import { describe, expect, it, vi } from "vitest";

import { makeBackup } from "@/domain/backup";
import { seed } from "@/lib/catalog";
import { LocalPlanRepository } from "@/lib/local-plan-repository";
import { LocalProposalRepository } from "@/lib/local-proposal-repository";
import { LocalQueueRepository } from "@/lib/local-queue-repository";
import { LocalTripRepository } from "@/lib/local-trip-repository";

const plans = new LocalPlanRepository();
const queue = new LocalQueueRepository();
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
vi.mock("@/lib/queue-repository-instance", () => ({
  get queueRepository() {
    return queue;
  },
}));
vi.mock("@/lib/trip-repository-instance", () => ({
  get tripRepository() {
    return trips;
  },
}));

const { importBackup } = await import("@/lib/backup-actions");

describe("importBackup", () => {
  it("writes every collection, the plan and the queue into the trip", async () => {
    const item = {
      id: "i1",
      placeId: seed.places[0].id,
      date: "2026-12-18",
      order: "a0",
      startTime: null,
      durationMin: null,
      note: null,
      status: "planned" as const,
      legNote: null,
      updatedAt: "2026-11-01T00:00:00.000Z",
    };
    const queued = {
      id: "q1",
      url: "https://maps.app.goo.gl/abc",
      name: null,
      lat: null,
      lng: null,
      note: null,
      createdAt: "2026-11-01T00:00:00.000Z",
      status: "queued" as const,
      cityId: null,
      placeId: null,
      category: null,
      updatedAt: null,
    };
    await importBackup(
      "trip-2",
      makeBackup(seed, [item], [queued], new Date("2026-11-02T00:00:00Z")),
    );

    const counts: Record<string, number> = {};
    trips.subscribe("trip-2", (name, records) => {
      counts[name] = records.length;
    })();
    expect(counts).toEqual({
      cities: seed.cities.length,
      stays: seed.stays.length,
      reservations: seed.reservations.length,
      places: seed.places.length,
    });

    let planned: unknown[] = [];
    plans.subscribe("trip-2", (items) => (planned = items))();
    expect(planned).toEqual([item]);

    let inQueue: unknown[] = [];
    queue.subscribe("trip-2", (items) => (inQueue = items))();
    expect(inQueue).toEqual([queued]);
  });
});
