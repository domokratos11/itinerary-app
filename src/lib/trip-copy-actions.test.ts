import { describe, expect, it, vi } from "vitest";

import { testPlace } from "@/domain/test-place";
import { copyTrip } from "@/domain/trip-copy";
import { TRIP_COLLECTIONS } from "@/domain/trip";
import type { TripSummary } from "@/domain/trip-repository";
import { LocalPlanRepository } from "@/lib/local-plan-repository";
import { LocalTripRepository } from "@/lib/local-trip-repository";
import { fixtureTrip } from "@/test/fixture-trip";

const plans = new LocalPlanRepository();
const trips = new LocalTripRepository();
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

const { readCopySource, writeTripCopy } =
  await import("@/lib/trip-copy-actions");

const ME = "ana@example.com";

async function sourceTrip() {
  const id = await trips.createTrip("Japan", ME);
  await trips.updateTrip(id, {
    members: [ME, "ben@example.com"],
    budget: { totalJPY: 500000, byCategory: {}, travellers: 2, byMember: {} },
  });
  for (const name of TRIP_COLLECTIONS)
    if (fixtureTrip[name].length)
      await trips.saveMany(id, name, fixtureTrip[name]);
  await trips.save(id, "places", testPlace({ id: "castle", cityId: "nagoya" }));
  await plans.save(id, {
    id: "stop-1",
    placeId: "castle",
    date: "2026-12-25",
    order: "a0",
    status: "done",
    updatedAt: "2026-10-29T00:00:00.000Z",
  });
  return id;
}

async function summaryOf(id: string): Promise<TripSummary> {
  let found: TripSummary | undefined;
  trips.watchMyTrips(ME, (list) => {
    found = list.find((t) => t.id === id);
  })();
  if (!found) throw new Error("No trip");
  return found;
}

describe("trip copy actions", () => {
  it("fills the target from the source and leaves the source untouched", async () => {
    const sourceId = await sourceTrip();
    const targetId = await trips.createTrip("Kyoto", ME, {
      dates: { startDate: "2027-03-01", endDate: "2027-03-12" },
    });
    const sourceBefore = structuredClone(await trips.readTrip(sourceId));
    const itemsBefore = structuredClone(await plans.readItems(sourceId));
    const summaryBefore = structuredClone(await summaryOf(sourceId));

    const source = await readCopySource(await summaryOf(sourceId));
    expect(source.data.cities).toHaveLength(2);
    expect(source.items).toHaveLength(1);

    const target = await summaryOf(targetId);
    const copy = copyTrip(source, ["plan", "hotels", "budget", "members"], {
      startDate: target.startDate,
      endDate: target.endDate,
      members: target.members,
      budget: target.budget,
      me: ME,
    });
    await writeTripCopy(targetId, copy, "Japan");

    const written = await trips.readTrip(targetId);
    expect(written.cities.map((c) => c.id)).toEqual(["tokyo-ueno", "nagoya"]);
    expect(written.stays.map((s) => [s.id, s.checkIn])).toEqual([
      ["tokyo-ueno-2027-03-01", "2027-03-01"],
      ["nagoya-2027-03-08", "2027-03-08"],
    ]);
    expect(written.places.map((p) => p.id)).toEqual(["castle"]);
    expect(written.reservations).toEqual([]);
    expect(await plans.readItems(targetId)).toEqual([
      expect.objectContaining({
        id: "stop-1",
        date: "2027-03-09",
        status: "planned",
      }),
    ]);
    const after = await summaryOf(targetId);
    expect(after.members).toEqual([ME, "ben@example.com"]);
    expect(after.budget?.totalJPY).toBe(500000);

    expect(await trips.readTrip(sourceId)).toEqual(sourceBefore);
    expect(await plans.readItems(sourceId)).toEqual(itemsBefore);
    expect(await summaryOf(sourceId)).toEqual(summaryBefore);

    const { activityRepository } =
      await import("@/lib/activity-repository-instance");
    expect(
      (await activityRepository.all(targetId)).map((a) => a.summary),
    ).toEqual(["copied parts of the itinerary Japan"]);
  });
});
