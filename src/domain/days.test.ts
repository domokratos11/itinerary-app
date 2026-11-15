import { describe, expect, it } from "vitest";

import {
  dayPlaceCities,
  dayTakesCity,
  deriveDays,
  tripPhase,
  weekdayOf,
} from "@/domain/days";
import type { Stay } from "@/domain/schemas";

const stay = (cityId: string, checkIn: string, checkOut: string): Stay => ({
  cityId,
  hotelName: `${cityId} hotel`,
  hotelMapsUrl: null,
  lat: null,
  lng: null,
  checkIn,
  checkOut,
});

const stays: Stay[] = [
  stay("tokyo-ueno", "2026-12-17", "2026-12-24"),
  stay("nagoya", "2026-12-24", "2026-12-27"),
  stay("hiroshima", "2026-12-27", "2026-12-30"),
];

describe("deriveDays", () => {
  it("covers every date from the first check-in to the last check-out", () => {
    const days = deriveDays(stays);
    expect(days[0].date).toBe("2026-12-17");
    expect(days.at(-1)?.date).toBe("2026-12-30");
    expect(days).toHaveLength(14);
  });

  it("gives an ordinary day to one city", () => {
    const day = deriveDays(stays).find((d) => d.date === "2026-12-20");
    expect(day?.cityIds).toEqual(["tokyo-ueno"]);
  });

  it("gives a transfer day to both the old and the new city", () => {
    const dec24 = deriveDays(stays).find((d) => d.date === "2026-12-24");
    expect(dec24?.cityIds).toEqual(["tokyo-ueno", "nagoya"]);
  });

  it("gives the last check-out day to the city being left", () => {
    const dec27 = deriveDays(stays).find((d) => d.date === "2026-12-27");
    expect(dec27?.cityIds).toEqual(["nagoya", "hiroshima"]);
  });

  it("returns no days for no stays", () => {
    expect(deriveDays([])).toEqual([]);
  });

  it("does not drift across month and year boundaries", () => {
    const days = deriveDays([stay("osaka", "2026-12-31", "2027-01-02")]);
    expect(days.map((d) => d.date)).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });
});

describe("deriveDays with the trip's own dates", () => {
  it("is unchanged without dates", () => {
    expect(deriveDays(stays, null)).toEqual(deriveDays(stays));
    expect(deriveDays(stays, undefined)).toEqual(deriveDays(stays));
  });

  it("gives a trip with no hotels a day per date, with no city", () => {
    const days = deriveDays([], {
      startDate: "2027-03-30",
      endDate: "2027-04-02",
    });
    expect(days).toEqual([
      { date: "2027-03-30", cityIds: [], stays: [] },
      { date: "2027-03-31", cityIds: [], stays: [] },
      { date: "2027-04-01", cityIds: [], stays: [] },
      { date: "2027-04-02", cityIds: [], stays: [] },
    ]);
  });

  it("has one day when the trip starts and ends on the same date", () => {
    const days = deriveDays([], {
      startDate: "2027-03-30",
      endDate: "2027-03-30",
    });
    expect(days.map((d) => d.date)).toEqual(["2027-03-30"]);
  });

  it("widens the hotels' range, leaving the extra days without a city", () => {
    const days = deriveDays(stays, {
      startDate: "2026-12-15",
      endDate: "2027-01-01",
    });
    expect(days[0]).toEqual({ date: "2026-12-15", cityIds: [], stays: [] });
    expect(days.at(-1)).toEqual({
      date: "2027-01-01",
      cityIds: [],
      stays: [],
    });
    expect(days).toHaveLength(18);
    const inside = days.filter(
      (d) => d.date >= "2026-12-17" && d.date <= "2026-12-30",
    );
    expect(inside).toEqual(deriveDays(stays));
  });

  it("keeps hotel nights that fall outside the dates", () => {
    const days = deriveDays(stays, {
      startDate: "2026-12-20",
      endDate: "2026-12-22",
    });
    expect(days).toEqual(deriveDays(stays));
  });

  it("ignores an end before the start", () => {
    expect(
      deriveDays(stays, { startDate: "2027-01-05", endDate: "2027-01-01" }),
    ).toEqual(deriveDays(stays));
  });
});

describe("dayTakesCity", () => {
  it("takes the day's own cities, and any city on a day with no hotel", () => {
    expect(dayTakesCity({ cityIds: ["nagoya"] }, "nagoya")).toBe(true);
    expect(dayTakesCity({ cityIds: ["nagoya"] }, "kyoto")).toBe(false);
    expect(dayTakesCity({ cityIds: [] }, "kyoto")).toBe(true);
    expect(dayPlaceCities({ cityIds: [] }, ["a", "b"])).toEqual(["a", "b"]);
    expect(dayPlaceCities({ cityIds: ["a"] }, ["a", "b"])).toEqual(["a"]);
  });
});

describe("weekdayOf", () => {
  it("names the weekday of a trip date", () => {
    expect(weekdayOf("2026-12-17")).toBe("Thu");
  });
});

describe("tripPhase", () => {
  const days = deriveDays([
    {
      cityId: "tokyo",
      hotelName: "h",
      hotelMapsUrl: null,
      lat: null,
      lng: null,
      checkIn: "2026-12-17",
      checkOut: "2026-12-20",
    },
  ]);

  it("counts the days left before the trip", () => {
    expect(tripPhase("2026-11-01", days)).toEqual({
      phase: "before",
      daysLeft: 46,
      first: "2026-12-17",
    });
  });

  it("is during the trip from the first to the last day", () => {
    expect(tripPhase("2026-12-17", days)).toEqual({
      phase: "during",
      date: "2026-12-17",
    });
    expect(tripPhase("2026-12-20", days).phase).toBe("during");
    expect(tripPhase("2026-12-21", days).phase).toBe("after");
  });
});
