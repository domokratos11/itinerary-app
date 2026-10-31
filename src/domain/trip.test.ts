import { describe, expect, it } from "vitest";

import { deriveDays } from "@/domain/days";
import type { PlanItem, Stay } from "@/domain/schemas";
import {
  activeTrip,
  endpointFor,
  groupDaysByStay,
  strandedItems,
  type TripData,
} from "@/domain/trip";

const NOW = new Date("2026-11-01T00:00:00.000Z");

const stay = (cityId: string, checkIn: string, checkOut: string): Stay => ({
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
  placeId: "p",
  date: "2026-12-20",
  order: "a0",
  startTime: null,
  durationMin: null,
  note: null,
  status: "planned",
  legNote: null,
  updatedAt: NOW.toISOString(),
  ...overrides,
});

describe("activeTrip", () => {
  it("hides archived records and sorts stays and cities by check-in", () => {
    const base = {
      archived: false,
      updatedAt: NOW.toISOString(),
      note: null,
      googlePlaceId: null,
      locationFetchedAt: null,
      locationSource: null,
    };
    const data: TripData = {
      cities: [
        { id: "osaka", name: "Osaka", color: "#000000", ...base },
        { id: "nagoya", name: "Nagoya", color: "#000000", ...base },
        { id: "old", name: "Old", color: "#000000", ...base, archived: true },
      ],
      stays: [
        { ...stay("osaka", "2026-12-27", "2026-12-30"), id: "b", ...base },
        { ...stay("nagoya", "2026-12-24", "2026-12-27"), id: "a", ...base },
      ],
      reservations: [],
      places: [],
      holidays: [
        {
          id: "gone",
          date: "2027-01-01",
          name: "Gone",
          kind: "holiday",
          note: null,
          archived: true,
          updatedAt: NOW.toISOString(),
        },
      ],
    };
    const active = activeTrip(data);
    expect(active.cities.map((c) => c.id)).toEqual(["nagoya", "osaka"]);
    expect(active.stays.map((s) => s.id)).toEqual(["a", "b"]);
    expect(active.holidays).toEqual([]);
  });
});

describe("endpointFor", () => {
  it("has no location for a hotel still to be decided", () => {
    const endpoint = endpointFor({
      ...stay("hiroshima", "a", "b"),
      hotelName: "To be decided",
    });
    expect(endpoint).toEqual({ name: "Hotel to be decided", location: null });
  });

  it("searches by hotel name when there are no coordinates", () => {
    expect(endpointFor(stay("nagoya", "a", "b"))?.location).toEqual({
      query: "nagoya hotel Japan",
    });
  });
});

describe("strandedItems", () => {
  const days = deriveDays([
    stay("tokyo-ueno", "2026-12-17", "2026-12-24"),
    stay("nagoya", "2026-12-24", "2026-12-27"),
  ]);
  const places = [
    { id: "zoo", cityId: "tokyo-ueno" },
    { id: "castle", cityId: "nagoya" },
  ];

  it("finds stops on dates that are no longer trip days", () => {
    const result = strandedItems([item({ date: "2027-02-01" })], days, places);
    expect(result).toEqual([
      {
        item: expect.objectContaining({ date: "2027-02-01" }),
        reason: "outside-trip",
      },
    ]);
  });

  it("finds stops whose city isn't on that day", () => {
    const result = strandedItems(
      [item({ placeId: "castle", date: "2026-12-20" })],
      days,
      places,
    );
    expect(result[0].reason).toBe("city-not-here");
  });

  it("keeps valid, transfer-day and removed stops out", () => {
    const result = strandedItems(
      [
        item({ id: "1", placeId: "zoo", date: "2026-12-20" }),
        item({ id: "2", placeId: "castle", date: "2026-12-24" }),
        item({
          id: "3",
          placeId: "castle",
          date: "2027-02-01",
          status: "removed",
        }),
      ],
      days,
      places,
    );
    expect(result).toEqual([]);
  });
});

describe("groupDaysByStay", () => {
  it("groups nights by hotel, with transfer days under the next hotel", () => {
    const stays = [
      stay("tokyo-ueno", "2026-12-17", "2026-12-19"),
      stay("nagoya", "2026-12-19", "2026-12-21"),
    ];
    const groups = groupDaysByStay(deriveDays(stays), stays);
    expect(
      groups.map((g) => [g.stay?.cityId, g.days.map((d) => d.date)]),
    ).toEqual([
      ["tokyo-ueno", ["2026-12-17", "2026-12-18"]],
      ["nagoya", ["2026-12-19", "2026-12-20", "2026-12-21"]],
    ]);
  });

  it("puts nights with no hotel in their own group", () => {
    const stays = [
      stay("tokyo-ueno", "2026-12-17", "2026-12-18"),
      stay("nagoya", "2026-12-20", "2026-12-21"),
    ];
    const groups = groupDaysByStay(deriveDays(stays), stays);
    expect(groups.map((g) => g.stay?.cityId ?? null)).toEqual([
      "tokyo-ueno",
      null,
      "nagoya",
    ]);
  });
});
