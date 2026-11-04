import { describe, expect, it } from "vitest";

import type { FlightRecord, PlanItem } from "./schemas";
import {
  clampExpiry,
  latestExpiry,
  newShareId,
  parseShareId,
  sharedTripData,
  shareStatus,
  toSharedTrip,
  type Share,
} from "./share";
import { testPlace } from "./test-place";
import type { TripData } from "./trip";
import { fixtureTrip } from "@/test/fixture-trip";

const NOW = new Date("2026-11-02T00:00:00.000Z");

const flight: FlightRecord = {
  id: "ua-837",
  airline: "Sample Air",
  flightNumber: "SA 837",
  departDate: "2026-12-15",
  departTime: "11:00",
  departAirport: "SFO",
  departCity: null,
  arriveDate: "2026-12-16",
  arriveTime: "15:00",
  arriveAirport: "HND",
  arriveCity: null,
  confirmation: "ABC123",
  costAmount: 1200,
  costCurrency: "USD",
  note: "Seat 32A, booking ref XYZ",
  archived: false,
  updatedAt: NOW.toISOString(),
};

function trip(): TripData {
  return {
    ...fixtureTrip,
    stays: fixtureTrip.stays.map((s) => ({ ...s, note: "Room 1203" })),
    reservations: fixtureTrip.reservations.map((r) => ({
      ...r,
      note: "Ticket ref 99",
    })),
    places: [
      {
        ...testPlace({ id: "castle", cityId: "nagoya" }),
        costEstimateJPY: 500,
      },
      {
        ...testPlace({ id: "gone", cityId: "nagoya" }),
        costEstimateJPY: 900,
        archived: true,
      },
    ],
    expenses: [
      {
        id: "dinner",
        title: "Dinner",
        amountJPY: 8000,
        category: "food",
        date: "2026-12-18",
        status: "paid",
        paidBy: "ana@example.com",
        placeId: null,
        reservationId: null,
        stayId: null,
        cityId: null,
        originalUSD: null,
        rateJPYPerUSD: null,
        note: null,
        archived: false,
        updatedAt: NOW.toISOString(),
      },
    ],
    flights: [flight],
  };
}

const items: PlanItem[] = [
  {
    id: "i1",
    placeId: "castle",
    date: "2026-12-18",
    order: "a",
    status: "planned",
    updatedAt: NOW.toISOString(),
  },
  {
    id: "i2",
    placeId: "castle",
    date: "2026-12-19",
    order: "a",
    status: "removed",
    updatedAt: NOW.toISOString(),
  },
];

// Every key anywhere in a value, to prove what isn't there.
function keysWithValues(value: unknown, found = new Map<string, unknown[]>()) {
  if (Array.isArray(value)) value.forEach((v) => keysWithValues(v, found));
  else if (value && typeof value === "object")
    for (const [key, v] of Object.entries(value)) {
      found.set(key, [...(found.get(key) ?? []), v]);
      keysWithValues(v, found);
    }
  return found;
}

describe("toSharedTrip", () => {
  const shared = toSharedTrip(trip(), items, NOW);
  const keys = keysWithValues(shared);

  it("holds no amount, confirmation or booking note", () => {
    for (const key of ["costEstimateJPY", "costAmount", "confirmation"])
      expect(keys.get(key)?.every((v) => v === null)).toBe(true);
    for (const key of ["amountJPY", "budget", "members", "paidBy", "expenses"])
      expect(keys.has(key)).toBe(false);
    expect(shared.stays.every((s) => s.note === null)).toBe(true);
    expect(shared.reservations.every((r) => r.note === null)).toBe(true);
    expect(shared.flights.every((f) => f.note === null)).toBe(true);
    expect(JSON.stringify(shared)).not.toMatch(/ABC123|XYZ|Room 1203|99/);
  });

  it("leaves out archived records and removed stops", () => {
    expect(shared.places.map((p) => p.id)).toEqual(["castle"]);
    expect(shared.items.map((i) => i.id)).toEqual(["i1"]);
  });

  it("keeps what a viewer needs", () => {
    expect(shared.cities).toHaveLength(fixtureTrip.cities.length);
    expect(shared.flights[0].flightNumber).toBe("SA 837");
    expect(shared.holidays[0].note).toBe("Most shops and sights are closed.");
  });

  it("drops Google coordinates past their 30 days", () => {
    const old = trip();
    old.places[0] = {
      ...old.places[0],
      lat: 35,
      lng: 136,
      locationSource: "google",
      locationFetchedAt: "2026-09-01T00:00:00.000Z",
    };
    const place = toSharedTrip(old, [], NOW).places[0];
    expect(place.lat).toBeNull();
    expect(place.googlePlaceId).toBe(old.places[0].googlePlaceId);
  });
});

describe("sharedTripData", () => {
  it("has no expenses and drops coordinates that aged while open", () => {
    const shared = toSharedTrip(trip(), items, NOW);
    shared.places[0] = {
      ...shared.places[0],
      lat: 35,
      lng: 136,
      locationSource: "google",
      locationFetchedAt: "2026-10-30T00:00:00.000Z",
    };
    expect(sharedTripData(shared, NOW).places[0].lat).toBe(35);
    const later = new Date("2026-12-01T00:00:00.000Z");
    const data = sharedTripData(shared, later);
    expect(data.places[0].lat).toBeNull();
    expect(data.expenses).toEqual([]);
  });
});

describe("links", () => {
  const share: Share = {
    id: "x",
    tripId: "trip-1",
    tripName: "Peru",
    label: "",
    createdAt: NOW.toISOString(),
    expiresAt: "2026-11-03T00:00:00.000Z",
    revoked: false,
    publishedAt: NOW.toISOString(),
  };

  it("are open until they expire or are revoked", () => {
    expect(shareStatus(share, NOW)).toBe("active");
    expect(shareStatus(share, new Date("2026-11-03T00:00:00.000Z"))).toBe(
      "expired",
    );
    expect(shareStatus({ ...share, revoked: true }, NOW)).toBe("revoked");
  });

  it("stay open at most 30 days", () => {
    const far = new Date("2027-06-01T00:00:00.000Z");
    expect(clampExpiry(far, NOW)).toEqual(latestExpiry(NOW));
    expect(latestExpiry(NOW).toISOString()).toBe("2026-12-02T00:00:00.000Z");
    expect(clampExpiry(new Date("2020-01-01"), NOW)).toEqual(NOW);
  });

  it("have long random ids that parse", () => {
    const a = newShareId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newShareId()).not.toBe(a);
    expect(parseShareId(a)).toBe(a);
    expect(parseShareId("short")).toBeNull();
    expect(parseShareId("../trips/x")).toBeNull();
  });
});
