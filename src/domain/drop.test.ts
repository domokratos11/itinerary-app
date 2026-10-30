import { describe, expect, it } from "vitest";

import { deriveDays } from "@/domain/days";
import { planDrop, type DragSource } from "@/domain/drop";
import type { PlanItem, Stay } from "@/domain/schemas";

const stay = (cityId: string, checkIn: string, checkOut: string): Stay => ({
  cityId,
  hotelName: `${cityId} hotel`,
  hotelMapsUrl: null,
  lat: null,
  lng: null,
  checkIn,
  checkOut,
});

const days = deriveDays([
  stay("tokyo", "2026-12-17", "2026-12-24"),
  stay("nagoya", "2026-12-24", "2026-12-27"),
]);

const item = (id: string, order: string): PlanItem => ({
  id,
  placeId: `p-${id}`,
  date: "2026-12-20",
  order,
  startTime: null,
  durationMin: null,
  note: null,
  status: "planned",
  updatedAt: "2026-11-01T00:00:00.000Z",
});

const stops = [item("a", "a0"), item("b", "a1"), item("c", "a2")];
const ctx = {
  date: "2026-12-20",
  stops,
  days,
  dayLength: (date: string) => (date === "2026-12-21" ? 4 : 0),
};
const stop = (i: number): DragSource => ({
  kind: "stop",
  item: stops[i],
  cityId: "tokyo",
});

describe("planDrop", () => {
  it("reorders a stop to the slot of the stop it is dropped on", () => {
    expect(planDrop(stop(0), { kind: "stop", index: 2 }, ctx)).toEqual({
      kind: "place",
      date: "2026-12-20",
      index: 2,
      cityId: "tokyo",
    });
  });

  it("does nothing when a stop is dropped where it already is", () => {
    expect(planDrop(stop(1), { kind: "stop", index: 1 }, ctx)).toEqual({
      kind: "none",
    });
    expect(planDrop(stop(2), { kind: "list" }, ctx)).toEqual({ kind: "none" });
    expect(planDrop(stop(0), { kind: "day", date: "2026-12-20" }, ctx)).toEqual(
      { kind: "none" },
    );
  });

  it("moves a stop to the end of another day", () => {
    expect(
      planDrop(stop(0), { kind: "day", date: "2026-12-21" }, ctx),
    ).toMatchObject({ kind: "place", date: "2026-12-21", index: 4 });
  });

  it("inserts a new place before the stop it is dropped on, or at the end", () => {
    const place: DragSource = { kind: "place", placeId: "x", cityId: "tokyo" };
    expect(planDrop(place, { kind: "stop", index: 1 }, ctx)).toMatchObject({
      index: 1,
    });
    expect(planDrop(place, { kind: "list" }, ctx)).toMatchObject({ index: 3 });
  });

  it("refuses a place whose city isn't on the target day", () => {
    const place: DragSource = { kind: "place", placeId: "x", cityId: "nagoya" };
    expect(planDrop(place, { kind: "list" }, ctx)).toEqual({
      kind: "refuse",
      reason: "city-not-on-day",
      date: "2026-12-20",
    });
    // Transfer day: both cities are there.
    expect(
      planDrop(place, { kind: "day", date: "2026-12-24" }, ctx),
    ).toMatchObject({ kind: "place", date: "2026-12-24" });
  });

  it("gives a queued link with no city the city of the day", () => {
    const queued: DragSource = { kind: "queued", queueId: "q", cityId: null };
    expect(planDrop(queued, { kind: "list" }, ctx)).toMatchObject({
      kind: "place",
      cityId: "tokyo",
    });
  });

  it("refuses a date that isn't a trip day", () => {
    expect(
      planDrop(stop(0), { kind: "day", date: "2027-03-01" }, ctx),
    ).toMatchObject({ kind: "refuse", reason: "not-a-day" });
  });
});
