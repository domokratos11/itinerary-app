import { describe, expect, it } from "vitest";

import { hoursDifference, parseGoogleHours } from "./live-hours";

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
    expect(hoursDifference("9:30-17:00", "9:30 AM – 5:00 PM")).toBeNull();
    expect(hoursDifference(null, "9:30 AM – 5:00 PM")).toBeNull();
    expect(hoursDifference("Varies", "9:30 AM – 5:00 PM")).toBeNull();
    expect(hoursDifference("9:30-17:00", null)).toBeNull();
    expect(hoursDifference("9:30-17:00", "Open 24 hours")).toBeNull();
  });

  it("flags different hours and a closed day", () => {
    expect(hoursDifference("9:30-17:00", "10:00 AM – 5:00 PM")).toMatch(
      /Our notes say 09:30–17:00/,
    );
    expect(hoursDifference("9:30-17:00", "Closed")).toMatch(/closed today/);
  });
});
