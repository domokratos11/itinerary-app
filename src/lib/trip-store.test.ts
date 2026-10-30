import { beforeEach, describe, expect, it } from "vitest";

import { LocalTripRepository } from "@/lib/local-trip-repository";
import { seed } from "@/lib/catalog";
import { useTripStore } from "@/lib/trip-store";

const store = () => useTripStore.getState();

describe("trip store", () => {
  beforeEach(() => store().reset());

  it("starts with the seed so pages render before Firestore answers", () => {
    expect(store().data.stays).toEqual(seed.stays);
    expect(store().live.stays).toBe(false);
  });

  it("keeps the seed for a collection that is still empty", async () => {
    const repo = new LocalTripRepository();
    const stop = repo.subscribe("trip-1", (name, records) =>
      store().setCollection(name, records),
    );
    expect(store().data.cities).toEqual(seed.cities);

    const city = { ...seed.cities[0], name: "Ueno" };
    await repo.save("trip-1", "cities", city);
    expect(store().live.cities).toBe(true);
    expect(store().data.cities).toEqual([city]);
    expect(store().data.places).toEqual(seed.places);
    stop();
  });

  it("applies a local change before the save completes", () => {
    const stay = { ...seed.stays[0], hotelName: "New hotel" };
    store().apply("stays", stay);
    expect(store().data.stays.find((s) => s.id === stay.id)?.hotelName).toBe(
      "New hotel",
    );
    expect(store().data.stays).toHaveLength(seed.stays.length);
  });
});
