import { beforeEach, describe, expect, it, vi } from "vitest";

import { seed } from "@/lib/catalog";
import { LocalTripRepository } from "@/lib/local-trip-repository";
import { useTripStore } from "@/lib/trip-store";

const repo = new LocalTripRepository();
vi.mock("@/lib/trip-repository-instance", () => ({
  get tripRepository() {
    return repo;
  },
}));

const { saveRecord } = await import("@/lib/trip-actions");

describe("saveRecord", () => {
  beforeEach(() => useTripStore.getState().reset());

  it("copies the rest of an unseeded collection on the first save", async () => {
    const stop = repo.subscribe("trip-1", (name, records) =>
      useTripStore.getState().setCollection(name, records),
    );
    const edited = { ...seed.stays[1], checkOut: "2026-12-26" };
    await saveRecord("trip-1", "stays", edited);

    const stays = useTripStore.getState().data.stays;
    expect(useTripStore.getState().live.stays).toBe(true);
    expect(stays).toHaveLength(seed.stays.length);
    expect(stays.find((s) => s.id === edited.id)?.checkOut).toBe("2026-12-26");
    // Other collections are untouched.
    expect(useTripStore.getState().live.places).toBe(false);
    stop();
  });
});
