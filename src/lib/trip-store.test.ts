import { beforeEach, describe, expect, it } from "vitest";

import { LocalTripRepository } from "@/lib/local-trip-repository";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

const store = () => useTripStore.getState();

describe("trip store", () => {
  beforeEach(() => store().reset());

  it("starts empty, with nothing loaded", () => {
    expect(store().data.stays).toEqual([]);
    expect(store().loaded.stays).toBe(false);
  });

  it("shows exactly what Firestore has, even when that is nothing", async () => {
    const repo = new LocalTripRepository();
    const stop = repo.subscribe("trip-1", (name, records) =>
      store().setCollection(name, records),
    );
    expect(store().loaded.cities).toBe(true);
    expect(store().data.cities).toEqual([]);

    const city = fixtureTrip.cities[0];
    await repo.save("trip-1", "cities", city);
    expect(store().data.cities).toEqual([city]);
    expect(store().data.places).toEqual([]);
    stop();
  });

  it("applies a local change before the save completes", () => {
    store().setCollection("stays", fixtureTrip.stays);
    const stay = { ...fixtureTrip.stays[0], hotelName: "New hotel" };
    store().apply("stays", stay);
    expect(store().data.stays.find((s) => s.id === stay.id)?.hotelName).toBe(
      "New hotel",
    );
    expect(store().data.stays).toHaveLength(fixtureTrip.stays.length);
  });
});
