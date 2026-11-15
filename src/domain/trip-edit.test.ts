import { describe, expect, it } from "vitest";

import {
  TripDatesSchema,
  TripSetupSchema,
  tripDatesOf,
  type PlanItem,
  type Stay,
} from "@/domain/schemas";
import { dayChanges, stayIssues, uniqueId } from "@/domain/trip-edit";

const stay = (
  id: string,
  cityId: string,
  checkIn: string,
  checkOut: string,
): Stay & { id: string } => ({
  id,
  cityId,
  hotelName: `${cityId} hotel`,
  hotelMapsUrl: null,
  lat: null,
  lng: null,
  checkIn,
  checkOut,
});

const item = (overrides: Partial<PlanItem>): PlanItem => ({
  id: "i",
  placeId: "castle",
  date: "2026-12-26",
  order: "a0",
  status: "planned",
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...overrides,
});

describe("stayIssues", () => {
  it("accepts back-to-back stays (transfer days)", () => {
    expect(
      stayIssues([
        stay("a", "tokyo", "2026-12-17", "2026-12-24"),
        stay("b", "nagoya", "2026-12-24", "2026-12-27"),
      ]),
    ).toEqual([]);
  });

  it("finds a gap between stays", () => {
    expect(
      stayIssues([
        stay("b", "nagoya", "2026-12-25", "2026-12-27"),
        stay("a", "tokyo", "2026-12-17", "2026-12-24"),
      ]),
    ).toEqual([
      {
        kind: "gap",
        from: "2026-12-24",
        to: "2026-12-25",
        between: ["a", "b"],
      },
    ]);
  });

  it("finds overlapping stays", () => {
    const [issue] = stayIssues([
      stay("a", "tokyo", "2026-12-17", "2026-12-24"),
      stay("b", "nagoya", "2026-12-22", "2026-12-27"),
    ]);
    expect(issue).toMatchObject({
      kind: "overlap",
      from: "2026-12-22",
      to: "2026-12-24",
    });
  });
});

describe("dayChanges", () => {
  const before = [
    stay("a", "tokyo", "2026-12-17", "2026-12-24"),
    stay("b", "nagoya", "2026-12-24", "2026-12-27"),
  ];
  const places = [{ id: "castle", cityId: "nagoya" }];

  it("lists days added and removed and the stops left behind", () => {
    const after = [before[0], { ...before[1], checkOut: "2026-12-25" }];
    expect(
      dayChanges(before, after, [item({ date: "2026-12-26" })], places),
    ).toEqual({
      added: [],
      removed: ["2026-12-26", "2026-12-27"],
      stranded: 1,
    });
  });

  it("doesn't count stops that were already stranded", () => {
    const stuck = item({ date: "2027-03-01" });
    expect(dayChanges(before, before, [stuck], places).stranded).toBe(0);
  });

  it("lists new days when a stay gets longer", () => {
    const after = [before[0], { ...before[1], checkOut: "2026-12-28" }];
    expect(dayChanges(before, after, [], places).added).toEqual(["2026-12-28"]);
  });

  it("counts the trip's own dates, before and after a change to them", () => {
    const range = { startDate: "2026-12-15", endDate: "2026-12-29" };
    const shorter = { startDate: "2026-12-16", endDate: "2026-12-27" };
    expect(
      dayChanges(
        before,
        before,
        [item({ date: "2026-12-28" }), item({ id: "j", date: "2026-12-15" })],
        places,
        range,
        shorter,
      ),
    ).toEqual({
      added: [],
      removed: ["2026-12-15", "2026-12-28", "2026-12-29"],
      stranded: 2,
    });
    expect(dayChanges(before, before, [], places, null, range).added).toEqual([
      "2026-12-15",
      "2026-12-16",
      "2026-12-28",
      "2026-12-29",
    ]);
  });

  it("lets a day with no hotel hold places from any city", () => {
    const range = { startDate: "2026-12-15", endDate: "2026-12-27" };
    // The castle is in Nagoya; Dec 15 has no hotel, so it can stay there.
    expect(
      dayChanges(before, before, [item({ date: "2026-12-15" })], places, range)
        .stranded,
    ).toBe(0);
  });
});

describe("trip dates", () => {
  it("accept a valid pair, including a one-day trip", () => {
    expect(
      tripDatesOf({ startDate: "2027-03-01", endDate: "2027-03-10" }),
    ).toEqual({ startDate: "2027-03-01", endDate: "2027-03-10" });
    expect(
      tripDatesOf({ startDate: "2027-03-01", endDate: "2027-03-01" }),
    ).not.toBeNull();
  });

  it("read as none when missing, half there, backwards or not dates", () => {
    expect(tripDatesOf({})).toBeNull();
    expect(tripDatesOf({ startDate: null, endDate: null })).toBeNull();
    expect(tripDatesOf({ startDate: "2027-03-01" })).toBeNull();
    expect(
      tripDatesOf({ startDate: "2027-03-10", endDate: "2027-03-01" }),
    ).toBeNull();
    expect(
      tripDatesOf({ startDate: "2027-02-30", endDate: "2027-03-01" }),
    ).toBeNull();
    expect(tripDatesOf({ startDate: 1, endDate: "2027-03-01" })).toBeNull();
    expect(
      TripDatesSchema.safeParse({
        startDate: "2027-03-10",
        endDate: "2027-03-01",
      }).success,
    ).toBe(false);
  });

  it("know the setup states", () => {
    expect(TripSetupSchema.safeParse("pending").success).toBe(true);
    expect(TripSetupSchema.safeParse("done").success).toBe(true);
    expect(TripSetupSchema.safeParse("later").success).toBe(false);
  });
});

describe("uniqueId", () => {
  it("makes a slug and avoids ids already taken", () => {
    expect(uniqueId("Kyoto (Gion)", [])).toBe("kyoto-gion");
    expect(uniqueId("Kyoto (Gion)", ["kyoto-gion"])).toBe("kyoto-gion-2");
    expect(uniqueId("Ōsaka", [])).toBe("osaka");
    expect(uniqueId("京都", [])).toBe("item");
  });
});
