import { describe, expect, it } from "vitest";

import {
  flightCostInYen,
  flightCostLabel,
  flightFromForm,
  flightRoute,
  flightsOnDay,
  flightsOutsideDays,
  flightToForm,
  nextFlight,
} from "./flights";
import { YEN_PER_USD } from "./budget";
import type { FlightRecord } from "./schemas";

const NOW = new Date("2026-11-01T00:00:00.000Z");

const flight = (over: Partial<FlightRecord>): FlightRecord => ({
  id: "xx-100",
  airline: "Sample Air",
  flightNumber: "XX 100",
  departDate: "2026-12-15",
  departTime: "10:00",
  departAirport: "AAA",
  departCity: "Alpha",
  arriveDate: "2026-12-15",
  arriveTime: "12:00",
  arriveAirport: "BBB",
  arriveCity: "Beta",
  confirmation: null,
  costAmount: null,
  costCurrency: "USD",
  note: null,
  archived: false,
  updatedAt: NOW.toISOString(),
  ...over,
});

describe("flights and days", () => {
  const overnight = flight({
    id: "o",
    departDate: "2026-12-16",
    arriveDate: "2026-12-17",
  });

  it("puts a flight on the days it leaves and lands", () => {
    expect(flightsOnDay([overnight], "2026-12-16")).toEqual([overnight]);
    expect(flightsOnDay([overnight], "2026-12-17")).toEqual([overnight]);
    expect(flightsOnDay([overnight], "2026-12-18")).toEqual([]);
  });

  it("finds flights leaving on dates the stays don't cover", () => {
    const first = flight({ id: "a", departDate: "2026-12-15" });
    const during = flight({ id: "b", departDate: "2026-12-18" });
    const last = flight({ id: "c", departDate: "2027-01-13" });
    const days = [{ date: "2026-12-17" }, { date: "2026-12-18" }];
    expect(flightsOutsideDays([first, during, last], days)).toEqual({
      before: [first],
      after: [last],
    });
  });

  it("lists every flight first when there are no days yet", () => {
    const only = flight({});
    expect(flightsOutsideDays([only], [])).toEqual({
      before: [only],
      after: [],
    });
  });

  it("finds the next flight, today included", () => {
    const a = flight({ id: "a", departDate: "2026-12-15" });
    const b = flight({ id: "b", departDate: "2027-01-12" });
    expect(nextFlight([a, b], "2026-12-15")).toBe(a);
    expect(nextFlight([a, b], "2026-12-16")).toBe(b);
    expect(nextFlight([a, b], "2027-01-13")).toBeNull();
  });

  it("words the route by airport code", () => {
    expect(flightRoute(flight({}))).toBe("AAA → BBB");
  });
});

describe("a flight's cost", () => {
  it("shows dollars or yen, and nothing when there's no cost", () => {
    expect(flightCostLabel(flight({ costAmount: 1234.5 }))).toBe("$1,234.50");
    expect(
      flightCostLabel(flight({ costAmount: 5000, costCurrency: "JPY" })),
    ).toBe("¥5,000");
    expect(flightCostLabel(flight({ costAmount: 0 }))).toBeNull();
    expect(flightCostLabel(flight({ costAmount: null }))).toBeNull();
  });

  it("gives the budget an amount in whole yen", () => {
    expect(flightCostInYen(flight({ costAmount: 100 }))).toBe(
      Math.round(100 * YEN_PER_USD),
    );
    expect(
      flightCostInYen(flight({ costAmount: 5000, costCurrency: "JPY" })),
    ).toBe(5000);
    expect(flightCostInYen(flight({ costAmount: 0 }))).toBeNull();
  });
});

describe("the flight form", () => {
  const form = {
    ...flightToForm(flight({})),
    flightNumber: " xx 100 ",
    departAirport: "aaa",
    confirmation: " abc123 ",
    costAmount: "$1,234.50",
  };

  it("tidies what's typed into a record", () => {
    const record = flightFromForm(form, "xx-100", NOW);
    expect(record).toMatchObject({
      flightNumber: "XX 100",
      departAirport: "AAA",
      confirmation: "ABC123",
      costAmount: 1234.5,
    });
  });

  it("leaves what's optional empty", () => {
    const record = flightFromForm(
      {
        ...form,
        departCity: " ",
        arriveCity: "",
        confirmation: "",
        costAmount: "",
        note: "",
      },
      "xx-100",
      NOW,
    );
    expect(record).toMatchObject({
      departCity: null,
      arriveCity: null,
      confirmation: null,
      costAmount: null,
      note: null,
    });
  });

  it.each([
    ["no airline", { airline: " " }],
    ["no flight number", { flightNumber: "" }],
    ["no date", { departDate: "" }],
    ["no time", { arriveTime: "" }],
    ["a long airport code", { departAirport: "ABCD" }],
    ["a negative cost", { costAmount: "-1" }],
    ["a cost that isn't a number", { costAmount: "free" }],
  ])("refuses %s", (_name, change) => {
    expect(flightFromForm({ ...form, ...change }, "xx-100", NOW)).toBeNull();
  });

  it("round-trips a saved flight", () => {
    const saved = flight({ confirmation: "ABC123", costAmount: 10 });
    expect(flightFromForm(flightToForm(saved), saved.id, NOW)).toEqual(saved);
  });
});
