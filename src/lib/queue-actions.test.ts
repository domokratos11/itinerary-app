import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QueuedPlace } from "@/domain/queue";
import { LocalPlanRepository } from "@/lib/local-plan-repository";
import { LocalQueueRepository } from "@/lib/local-queue-repository";
import { LocalTripRepository } from "@/lib/local-trip-repository";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";

const plans = new LocalPlanRepository();
const queue = new LocalQueueRepository();
const trips = new LocalTripRepository();
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

const { assignQueued, queueAdd } = await import("@/lib/queue-actions");

const TRIP = "trip-1";
const NOW = new Date("2026-11-01T00:00:00.000Z");

function current<T>(subscribe: (cb: (v: T) => void) => () => void): T {
  let value!: T;
  subscribe((v) => (value = v))();
  return value;
}

describe("assignQueued", () => {
  beforeEach(() => {
    useTripStore.getState().reset();
    usePlanStore.getState().reset();
  });

  it("makes a draft place, adds it to the day and marks the link promoted", async () => {
    await queueAdd(
      TRIP,
      {
        url: "https://maps.app.goo.gl/abc",
        name: "Oasis 21",
        lat: 35.17,
        lng: 136.9,
        note: null,
      },
      NOW,
    );
    const [item] = current<QueuedPlace[]>((cb) => queue.subscribe(TRIP, cb));
    expect(item.status).toBe("queued");

    const { place } = await assignQueued(
      TRIP,
      item,
      "nagoya",
      "2026-12-25",
      NOW,
    );

    expect(place).toMatchObject({ cityId: "nagoya", status: "draft" });
    const places = useTripStore.getState().data.places;
    expect(places.find((p) => p.id === place.id)).toBeDefined();
    // The seed places came along on the first save, so none were lost.
    expect(places.length).toBeGreaterThan(100);

    const planned = current<{ placeId: string; date: string }[]>((cb) =>
      plans.subscribe(TRIP, cb),
    );
    expect(planned).toEqual([
      expect.objectContaining({ placeId: place.id, date: "2026-12-25" }),
    ]);

    const [after] = current<QueuedPlace[]>((cb) => queue.subscribe(TRIP, cb));
    expect(after).toMatchObject({
      status: "promoted",
      placeId: place.id,
      cityId: "nagoya",
    });
  });

  it("adds to the city only when no day is given", async () => {
    await queueAdd(
      TRIP,
      {
        url: "https://maps.app.goo.gl/def",
        name: "Cafe",
        lat: null,
        lng: null,
        note: null,
      },
      NOW,
    );
    const item = current<QueuedPlace[]>((cb) => queue.subscribe(TRIP, cb)).find(
      (i) => i.name === "Cafe",
    )!;
    const { place } = await assignQueued(TRIP, item, "osaka", null, NOW);
    const planned = current<{ placeId: string }[]>((cb) =>
      plans.subscribe(TRIP, cb),
    );
    expect(planned.some((p) => p.placeId === place.id)).toBe(false);
  });
});
