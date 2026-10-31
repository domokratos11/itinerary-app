import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n";

import {
  hoursDifference,
  openNowFrom,
  parseGoogleHours,
  type HoursPeriod,
} from "./live-hours";

describe("openNowFrom", () => {
  const JST = 540;
  // 2026-12-16 is a Wednesday (day 3).
  const tokyo = (time: string) => new Date(`2026-12-16T${time}:00+09:00`);
  const day = (d: number, open: number, close: number): HoursPeriod => ({
    open: { day: d, hour: open, minute: 0 },
    close: { day: d, hour: close, minute: 0 },
  });

  it("uses the place's own time, not the device's", () => {
    const periods = [day(3, 9, 17)];
    expect(openNowFrom(periods, JST, tokyo("09:00"))).toBe(true);
    expect(openNowFrom(periods, JST, tokyo("16:59"))).toBe(true);
    expect(openNowFrom(periods, JST, tokyo("17:00"))).toBe(false);
    expect(openNowFrom(periods, JST, tokyo("08:59"))).toBe(false);
  });

  it("is closed on a day with no period", () => {
    expect(openNowFrom([day(4, 9, 17)], JST, tokyo("12:00"))).toBe(false);
  });

  it("handles hours running past midnight", () => {
    const periods: HoursPeriod[] = [
      {
        open: { day: 2, hour: 22, minute: 0 },
        close: { day: 3, hour: 2, minute: 0 },
      },
    ];
    expect(openNowFrom(periods, JST, tokyo("01:00"))).toBe(true);
    expect(openNowFrom(periods, JST, tokyo("03:00"))).toBe(false);
  });

  it("handles hours running from Saturday into Sunday", () => {
    const periods: HoursPeriod[] = [
      {
        open: { day: 6, hour: 22, minute: 0 },
        close: { day: 0, hour: 2, minute: 0 },
      },
    ];
    // 2026-12-20 is a Sunday, 2026-12-19 a Saturday.
    const sunday = new Date("2026-12-20T01:00:00+09:00");
    const saturday = new Date("2026-12-19T23:00:00+09:00");
    expect(openNowFrom(periods, JST, sunday)).toBe(true);
    expect(openNowFrom(periods, JST, saturday)).toBe(true);
  });

  it("treats no closing time as always open", () => {
    const periods: HoursPeriod[] = [
      { open: { day: 0, hour: 0, minute: 0 }, close: null },
    ];
    expect(openNowFrom(periods, JST, tokyo("03:00"))).toBe(true);
  });

  it("says nothing without hours or an offset", () => {
    expect(openNowFrom([], JST, tokyo("12:00"))).toBeNull();
    expect(openNowFrom([day(3, 9, 17)], null, tokyo("12:00"))).toBeNull();
  });
});

describe("parseGoogleHours", () => {
  it("reads 12-hour times, with odd spaces", () => {
    expect(parseGoogleHours("9:30 AM – 5:00 PM")).toEqual({
      open: "09:30",
      close: "17:00",
    });
    expect(parseGoogleHours("9:30 AM – 5:00 PM")).toEqual({
      open: "09:30",
      close: "17:00",
    });
  });

  it("uses the second AM or PM when the first is left out", () => {
    expect(parseGoogleHours("1:00 – 5:30 PM")).toEqual({
      open: "13:00",
      close: "17:30",
    });
  });

  it("handles noon and midnight", () => {
    expect(parseGoogleHours("12:00 PM – 12:00 AM")).toEqual({
      open: "12:00",
      close: "00:00",
    });
  });

  it("gives up on anything else", () => {
    expect(parseGoogleHours("Open 24 hours")).toBeNull();
    expect(parseGoogleHours("Closed")).toBeNull();
  });
});

describe("hoursDifference", () => {
  it("is quiet when they agree or can't be compared", () => {
    expect(hoursDifference("9:30-17:00", "9:30 AM – 5:00 PM", t)).toBeNull();
    expect(hoursDifference(null, "9:30 AM – 5:00 PM", t)).toBeNull();
    expect(hoursDifference("Varies", "9:30 AM – 5:00 PM", t)).toBeNull();
    expect(hoursDifference("9:30-17:00", null, t)).toBeNull();
    expect(hoursDifference("9:30-17:00", "Open 24 hours", t)).toBeNull();
  });

  it("flags different hours and a closed day", () => {
    expect(hoursDifference("9:30-17:00", "10:00 AM – 5:00 PM", t)).toMatch(
      /Our notes say 09:30–17:00/,
    );
    expect(hoursDifference("9:30-17:00", "Closed", t)).toMatch(/closed today/);
  });
});
