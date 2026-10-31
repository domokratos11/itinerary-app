import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocalTripRepository } from "@/lib/local-trip-repository";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

const repo = new LocalTripRepository();
vi.mock("@/lib/trip-repository-instance", () => ({
  get tripRepository() {
    return repo;
  },
}));

const { saveRecord } = await import("@/lib/trip-actions");

describe("saveRecord", () => {
  beforeEach(() => useTripStore.getState().reset());

  it("writes only the record that changed", async () => {
    const stop = repo.subscribe("trip-1", (name, records) =>
      useTripStore.getState().setCollection(name, records),
    );
    const edited = { ...fixtureTrip.stays[1], checkOut: "2026-12-26" };
    await saveRecord("trip-1", "stays", edited);

    expect(useTripStore.getState().data.stays).toEqual([edited]);
    expect(useTripStore.getState().data.places).toEqual([]);
    stop();
  });
});
