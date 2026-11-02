import { describe, expect, it, vi } from "vitest";

import { flightRecords } from "./flights-push";

vi.mock("./admin-db", () => ({ adminDb: vi.fn() }));

const NOW = new Date("2026-11-01T00:00:00.000Z");
const entry = {
  id: "xx-100-2026-12-15",
  airline: "Sample Air",
  flightNumber: "XX 100",
  departDate: "2026-12-15",
  departTime: "10:00",
  departAirport: "AAA",
  departCity: null,
  arriveDate: "2026-12-15",
  arriveTime: "12:00",
  arriveAirport: "BBB",
  arriveCity: null,
  confirmation: "ABC123",
  costAmount: 10.5,
  costCurrency: "USD",
  note: null,
};

describe("flightRecords", () => {
  it("makes live records from the file", () => {
    expect(flightRecords([entry], NOW)).toEqual([
      { ...entry, archived: false, updatedAt: NOW.toISOString() },
    ]);
  });

  it("refuses a file with a wrong flight, saving nothing", () => {
    expect(() =>
      flightRecords([entry, { ...entry, departAirport: "Tokyo" }], NOW),
    ).toThrow();
  });
});
