import { describe, expect, it } from "vitest";

import {
  cityFigures,
  hoursLeftInTokyoDay,
  mustsNotPlanned,
  nextReservation,
  nightsWithoutHotel,
  placesByCategory,
  placesByPriority,
  quietDays,
  routeLegs,
  stayTonight,
  stopCounts,
  stopsLeftToday,
  stopsOnClosedDays,
  stopsPerDay,
  tripClock,
  upcomingHolidays,
} from "./dashboard";
import type { TripDay } from "./days";
import type { HolidayRecord, PlanItem } from "./schemas";
import { testPlace } from "./test-place";

const day = (date: string, ...cityIds: string[]): TripDay => ({
  date,
  cityIds,
  stays: [],
});
const days = [
  day("2026-12-15", "tokyo"),
  day("2026-12-16", "tokyo"),
  day("2026-12-17", "tokyo", "kyoto"),
  day("2026-12-18", "kyoto"),
];
const stop = (
  id: string,
  placeId: string,
  date: string,
  status: PlanItem["status"] = "planned",
): PlanItem => ({
  id,
  placeId,
  date,
  order: "a0",
  startTime: null,
  durationMin: null,
  note: null,
  status,
  legNote: null,
  updatedAt: "2026-11-01T00:00:00.000Z",
});

describe("tripClock", () => {
  it("counts down before the trip", () => {
    expect(tripClock("2026-12-05", days)).toEqual({
      phase: "before",
      daysUntil: 10,
      totalDays: 4,
      first: "2026-12-15",
    });
  });

  it("gives the day number and days left during it", () => {
    expect(tripClock("2026-12-16", days)).toEqual({
      phase: "during",
      dayNumber: 2,
      totalDays: 4,
      daysLeft: 2,
    });
  });

  it("knows when it's over and when there's no trip yet", () => {
    expect(tripClock("2027-01-01", days).phase).toBe("after");
    expect(tripClock("2026-12-16", [])).toEqual({ phase: "none" });
  });
});

describe("hoursLeftInTokyoDay", () => {
  it("uses Japan time and rounds up", () => {
    expect(hoursLeftInTokyoDay(new Date("2026-12-16T14:30:00.000Z"))).toBe(1);
    expect(hoursLeftInTokyoDay(new Date("2026-12-16T00:00:00.000Z"))).toBe(15);
  });
});

describe("stops", () => {
  const items = [
    stop("a", "zoo", "2026-12-16"),
    stop("b", "zoo", "2026-12-16", "done"),
    stop("c", "tower", "2026-12-16", "skipped"),
    stop("d", "tower", "2026-12-18", "removed"),
    stop("e", "gone", "2026-12-18"),
  ];
  const placesById = new Map([
    ["zoo", { cityId: "tokyo" }],
    ["tower", { cityId: "kyoto" }],
  ]);

  it("counts by status, leaving out removed ones", () => {
    expect(stopCounts(items)).toEqual({ planned: 2, done: 1, skipped: 1 });
    expect(stopsLeftToday(items, "2026-12-16")).toBe(1);
  });

  it("splits each day by city", () => {
    const perDay = stopsPerDay(days, items, placesById);
    expect(perDay[1]).toEqual({
      date: "2026-12-16",
      total: 3,
      byCity: { tokyo: 2, kyoto: 1 },
    });
    expect(perDay[3].byCity).toEqual({ other: 1 });
  });

  it("finds days with room, from today on", () => {
    const perDay = stopsPerDay(days, items, placesById);
    expect(quietDays(perDay, "2026-12-16").map((d) => d.date)).toEqual([
      "2026-12-17",
      "2026-12-18",
    ]);
  });
});

describe("places", () => {
  const must = testPlace({ id: "must-1", priority: "must" });
  const planned = testPlace({ id: "must-2", priority: "must" });
  const want = testPlace({ id: "want-1", priority: "want", category: "food" });

  it("counts every category and priority", () => {
    const places = [must, want];
    expect(
      placesByCategory(places).find((c) => c.category === "food")?.count,
    ).toBe(1);
    expect(placesByPriority(places)).toEqual([
      { priority: "must", count: 1 },
      { priority: "want", count: 1 },
      { priority: "maybe", count: 0 },
    ]);
  });

  it("finds must-sees not on any day, ignoring removed stops", () => {
    const items = [
      stop("a", "must-2", "2026-12-16"),
      stop("b", "must-1", "2026-12-16", "removed"),
    ];
    expect(
      mustsNotPlanned([must, planned, want], items).map((p) => p.id),
    ).toEqual(["must-1"]);
  });

  it("adds up a city's places, plan, nights and estimate", () => {
    const zoo = testPlace({
      id: "zoo",
      cityId: "tokyo",
      costEstimateJPY: 600,
    });
    const free = testPlace({
      id: "walk",
      cityId: "tokyo",
      costEstimateJPY: null,
    });
    const [tokyo] = cityFigures(
      ["tokyo"],
      [zoo, free],
      [stop("a", "zoo", "2026-12-16"), stop("b", "zoo", "2026-12-17")],
      [{ cityId: "tokyo", checkIn: "2026-12-15", checkOut: "2026-12-17" }],
      2,
    );
    expect(tokyo).toEqual({
      cityId: "tokyo",
      places: 2,
      inPlan: 1,
      estimateYen: 2400,
      nights: 2,
    });
  });
});

describe("route", () => {
  it("runs through the cities in order, a transfer day to the arrival", () => {
    expect(routeLegs(days)).toEqual([
      { cityId: "tokyo", days: 2 },
      { cityId: "kyoto", days: 2 },
    ]);
  });

  it("finds the next booking and tonight's hotel", () => {
    const bookings = [{ date: "2026-12-10" }, { date: "2026-12-20" }];
    expect(nextReservation(bookings, "2026-12-11")?.date).toBe("2026-12-20");
    expect(nextReservation(bookings, "2026-12-21")).toBeNull();
    const stays = [
      { checkIn: "2026-12-15", checkOut: "2026-12-17" },
      { checkIn: "2026-12-17", checkOut: "2026-12-18" },
    ];
    expect(stayTonight(stays, "2026-12-17")).toBe(stays[1]);
    expect(stayTonight(stays, "2026-12-18")).toBeNull();
  });

  it("lists nights with no hotel, not the last day", () => {
    expect(
      nightsWithoutHotel(days, [
        { checkIn: "2026-12-15", checkOut: "2026-12-16" },
      ]),
    ).toEqual(["2026-12-16", "2026-12-17"]);
  });
});

describe("watch out", () => {
  it("flags stops still to come on a closed date", () => {
    const place = testPlace({ id: "zoo", closedDates: ["2026-12-16"] });
    const placesById = new Map([["zoo", place]]);
    const items = [
      stop("a", "zoo", "2026-12-16"),
      stop("b", "zoo", "2026-12-17"),
      stop("c", "zoo", "2026-12-16", "skipped"),
    ];
    expect(
      stopsOnClosedDays(items, placesById, "2026-12-15").map((c) => c.item.id),
    ).toEqual(["a"]);
    expect(stopsOnClosedDays(items, placesById, "2026-12-17")).toEqual([]);
  });

  it("lists the next holidays first", () => {
    const holiday = (date: string) => ({ date }) as HolidayRecord;
    expect(
      upcomingHolidays(
        [holiday("2027-01-01"), holiday("2026-12-31"), holiday("2026-12-01")],
        "2026-12-16",
      ).map((h) => h.date),
    ).toEqual(["2026-12-31", "2027-01-01"]);
  });
});
