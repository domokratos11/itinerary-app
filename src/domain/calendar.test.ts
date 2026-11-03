import { describe, expect, it } from "vitest";

import { calendarWeeks, stayBands } from "./calendar";
import { deriveDays } from "./days";
import type { Stay } from "./schemas";

function stay(cityId: string, checkIn: string, checkOut: string): Stay {
  return {
    cityId,
    hotelName: `${cityId} hotel`,
    hotelMapsUrl: null,
    lat: null,
    lng: null,
    checkIn,
    checkOut,
  };
}

const stays = [
  stay("tokyo", "2026-12-15", "2026-12-22"),
  stay("kyoto", "2026-12-22", "2027-01-12"),
];
const days = deriveDays(stays);

describe("calendarWeeks", () => {
  const weeks = calendarWeeks(days);

  it("runs whole weeks from Monday to Sunday across the new year", () => {
    expect(weeks[0][0].date).toBe("2026-12-14");
    expect(weeks.at(-1)!.at(-1)!.date).toBe("2027-01-17");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks).toHaveLength(5);
  });

  it("marks days outside the trip", () => {
    expect(weeks[0][0].day).toBeNull();
    expect(weeks[0][1].day?.date).toBe("2026-12-15");
    expect(weeks.at(-1)![1].day?.date).toBe("2027-01-12");
    expect(weeks.at(-1)![2].day).toBeNull();
  });

  it("names the month on the first day and on each 1st", () => {
    const shown = weeks.flat().filter((c) => c.showMonth);
    expect(shown.map((c) => c.date)).toEqual(["2026-12-15", "2027-01-01"]);
    const jan1 = weeks.flat().find((c) => c.date === "2027-01-01")!;
    expect(jan1.monthIndex).toBe(1);
    expect(weeks[0][1].monthIndex).toBe(0);
  });

  it("is empty with no days", () => {
    expect(calendarWeeks([])).toEqual([]);
  });
});

describe("stayBands", () => {
  const weeks = calendarWeeks(days);

  it("draws one bar per hotel per week, by the night slept there", () => {
    // Week of Dec 21: Monday in Tokyo, the transfer day onwards in Kyoto.
    const bands = stayBands(weeks[1], stays);
    expect(bands.map((b) => [b.stay.cityId, b.start, b.span])).toEqual([
      ["tokyo", 0, 1],
      ["kyoto", 1, 6],
    ]);
  });

  it("leaves days outside the trip without a bar", () => {
    const bands = stayBands(weeks[0], stays);
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ start: 1, span: 6 });
  });
});
