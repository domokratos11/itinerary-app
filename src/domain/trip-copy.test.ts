import { describe, expect, it } from "vitest";

import {
  BudgetSchema,
  PlanItemSchema,
  TripDataSchema,
  type CashRecord,
  type ExpenseRecord,
  type FlightRecord,
  type PlanItem,
  type TodoListRecord,
  type TodoRecord,
} from "./schemas";
import { testPlace } from "./test-place";
import type { TripData } from "./trip";
import {
  availableParts,
  COPY_PARTS,
  copyShift,
  copyTrip,
  MAX_MEMBERS,
  neededBy,
  needsOf,
  withNeeds,
  type CopySource,
  type CopyTarget,
} from "./trip-copy";
import { fixtureTrip } from "@/test/fixture-trip";

const NOW = new Date("2026-11-15T10:00:00.000Z");
const OLD = "2026-10-29T00:00:00.000Z";
const ME = "ana@example.com";

const flight: FlightRecord = {
  id: "jl1-2026-12-16",
  airline: "Sample Air",
  flightNumber: "JL1",
  departDate: "2026-12-16",
  departTime: "10:00",
  departAirport: "SFO",
  departCity: null,
  arriveDate: "2026-12-17",
  arriveTime: "14:00",
  arriveAirport: "HND",
  arriveCity: "Tokyo",
  confirmation: "ABC123",
  costAmount: 900,
  costCurrency: "USD",
  note: "Window seat",
  archived: false,
  updatedAt: OLD,
};

const list: TodoListRecord = {
  id: "packing",
  title: "Packing",
  description: null,
  color: "#2563eb",
  order: 0,
  archived: false,
  updatedAt: OLD,
};

const todo: TodoRecord = {
  id: "adapter",
  listId: "packing",
  title: "Plug adapter",
  description: null,
  dueDate: "2026-12-10",
  status: "done",
  priority: "normal",
  assignee: "ben@example.com",
  order: 0,
  completedAt: "2026-11-01T00:00:00.000Z",
  archived: false,
  updatedAt: OLD,
};

const expense: ExpenseRecord = {
  id: "hotel-cost",
  title: "Hotel",
  amountJPY: 50000,
  category: "booking",
  date: "2026-12-17",
  status: "paid",
  paidBy: null,
  placeId: null,
  reservationId: "flight-2026-12-15-1",
  stayId: "tokyo-ueno-2026-12-17",
  cityId: null,
  originalUSD: null,
  rateJPYPerUSD: null,
  paymentMethod: "card",
  note: null,
  archived: false,
  updatedAt: OLD,
};

const cash: CashRecord = {
  id: "atm",
  kind: "withdrawal",
  date: "2026-12-18",
  amountJPY: 10000,
  amountUSD: null,
  by: ME,
  to: null,
  note: null,
  archived: false,
  updatedAt: OLD,
};

function item(fields: Partial<PlanItem>): PlanItem {
  return {
    id: "item-1",
    placeId: "castle",
    date: "2026-12-25",
    order: "a0",
    status: "done",
    updatedAt: OLD,
    ...fields,
  };
}

// The sample trip with one of everything added. Like the Japan trip, it has
// no dates of its own: its first day is its first check-in, Dec 17.
function source(overrides: Partial<CopySource["summary"]> = {}): CopySource {
  const data: TripData = {
    ...fixtureTrip,
    cities: [
      ...fixtureTrip.cities,
      {
        id: "osaka",
        name: "Osaka",
        color: "#c2410c",
        archived: true,
        updatedAt: OLD,
      },
    ],
    stays: [
      {
        ...fixtureTrip.stays[0],
        note: "Door code 1234",
        googlePlaceId: "g-hotel",
        lat: 35.7,
        lng: 139.7,
        locationSource: "google",
        locationFetchedAt: "2026-11-10T00:00:00.000Z",
      },
      fixtureTrip.stays[1],
      {
        ...fixtureTrip.stays[1],
        id: "nagoya-2026-12-01",
        checkIn: "2026-12-01",
        checkOut: "2026-12-02",
        archived: true,
      },
    ],
    reservations: fixtureTrip.reservations.map((r) => ({
      ...r,
      note: "Seat 12A",
    })),
    places: [
      testPlace({
        id: "castle",
        cityId: "nagoya",
        name: "Nagoya Castle",
        googlePlaceId: "g-castle",
        lat: 35.18,
        lng: 136.9,
        locationSource: "google",
        locationFetchedAt: "2026-11-01T00:00:00.000Z",
      }),
      testPlace({ id: "gone", archived: true }),
      testPlace({ id: "in-osaka", cityId: "osaka" }),
    ],
    flights: [flight],
    expenses: [expense],
    cash: [cash],
    todoLists: [list],
    todos: [todo],
  };
  return {
    summary: {
      name: "Japan",
      members: [ME, "ben@example.com"],
      budget: {
        totalJPY: 800000,
        byCategory: { food: 100000 },
        travellers: 2,
        byMember: { [ME]: 400000, "ben@example.com": 400000 },
      },
      startDate: null,
      ...overrides,
    },
    data,
    items: [
      item({ id: "item-1" }),
      item({ id: "item-2", status: "removed" }),
      item({ id: "item-3", placeId: "gone" }),
    ],
  };
}

const target = (fields: Partial<CopyTarget> = {}): CopyTarget => ({
  startDate: "2027-03-01",
  endDate: "2027-03-12",
  members: [ME],
  budget: null,
  me: ME,
  ...fields,
});

describe("copyShift", () => {
  it("counts from the first check-in when the source has no dates", () => {
    // Dec 17 to Mar 1.
    expect(copyShift(source(), "2027-03-01")).toBe(74);
  });

  it("counts from the source's own start date when it has one", () => {
    expect(copyShift(source({ startDate: "2026-12-15" }), "2026-12-20")).toBe(
      5,
    );
    expect(copyShift(source({ startDate: "2026-12-15" }), "2026-12-10")).toBe(
      -5,
    );
  });

  it("moves nothing when the source has no dates or hotels, or the target no dates", () => {
    const bare = { ...source(), data: { ...fixtureTrip, stays: [] } };
    expect(copyShift(bare, "2027-03-01")).toBe(0);
    expect(copyShift(source(), null)).toBe(0);
  });
});

describe("dependencies", () => {
  it("adds what a part needs and unticks what needs it", () => {
    expect(withNeeds(["plan"])).toEqual(["cities", "places", "plan"]);
    expect(withNeeds(["hotels", "budget"])).toEqual([
      "cities",
      "hotels",
      "budget",
    ]);
    expect(neededBy("cities")).toEqual(["places", "hotels", "plan"]);
    expect(neededBy("places")).toEqual(["plan"]);
    expect(needsOf("plan")).toEqual(["cities", "places"]);
  });

  it("brings the cities along when only the plan is chosen", () => {
    const copy = copyTrip(source(), ["plan"], target(), NOW);
    expect(copy.report.parts).toEqual(["cities", "places", "plan"]);
    expect(copy.records.cities.map((c) => c.id)).toEqual([
      "tokyo-ueno",
      "nagoya",
    ]);
    expect(copy.records.places.map((p) => p.id)).toEqual(["castle"]);
    expect(copy.items.map((i) => i.id)).toEqual(["item-1"]);
    expect(copy.records.stays).toEqual([]);
  });
});

describe("copyTrip", () => {
  it("moves the hotels, clears their notes and renames their dated IDs", () => {
    const copy = copyTrip(source(), ["hotels"], target(), NOW);
    expect(copy.records.stays).toEqual([
      expect.objectContaining({
        id: "tokyo-ueno-2027-03-01",
        checkIn: "2027-03-01",
        checkOut: "2027-03-08",
        note: null,
        // Google's fields stay with their first fetch time.
        googlePlaceId: "g-hotel",
        locationFetchedAt: "2026-11-10T00:00:00.000Z",
        archived: false,
        updatedAt: NOW.toISOString(),
      }),
      expect.objectContaining({
        id: "nagoya-2027-03-08",
        checkIn: "2027-03-08",
        checkOut: "2027-03-11",
      }),
    ]);
  });

  it("keeps IDs as they are when nothing moves", () => {
    const copy = copyTrip(
      source(),
      ["hotels", "bookings"],
      target({ startDate: "2026-12-17", endDate: "2026-12-27" }),
      NOW,
    );
    expect(copy.report.shift).toBe(0);
    expect(copy.records.stays.map((s) => s.id)).toEqual([
      "tokyo-ueno-2026-12-17",
      "nagoya-2026-12-24",
    ]);
    expect(copy.records.reservations.map((r) => r.id)).toEqual([
      "flight-2026-12-15-1",
    ]);
  });

  it("leaves out flight confirmations, costs and notes", () => {
    const copy = copyTrip(source(), ["flights", "bookings"], target(), NOW);
    expect(copy.records.flights).toEqual([
      {
        ...flight,
        id: "jl1-2027-02-28",
        departDate: "2027-02-28",
        arriveDate: "2027-03-01",
        confirmation: null,
        costAmount: null,
        costCurrency: "USD",
        note: null,
        updatedAt: NOW.toISOString(),
      },
    ]);
    expect(copy.records.reservations).toEqual([
      expect.objectContaining({
        id: "flight-2027-02-27-1",
        date: "2027-02-27",
        note: null,
      }),
    ]);
  });

  it("copies the catalogue as it is, without archived places or cities", () => {
    const copy = copyTrip(source(), ["places"], target(), NOW);
    expect(copy.records.cities.map((c) => c.id)).toEqual([
      "tokyo-ueno",
      "nagoya",
    ]);
    expect(copy.records.places).toEqual([
      {
        ...source().data.places[0],
        updatedAt: NOW.toISOString(),
      },
    ]);
    expect(copy.records.places[0].locationFetchedAt).toBe(
      "2026-11-01T00:00:00.000Z",
    );
  });

  it("plans the stops again on the moved dates, without removed ones", () => {
    const copy = copyTrip(source(), ["plan"], target(), NOW);
    expect(copy.items).toEqual([
      {
        id: "item-1",
        placeId: "castle",
        date: "2027-03-09",
        order: "a0",
        status: "planned",
        updatedAt: NOW.toISOString(),
      },
    ]);
  });

  it("lists what lands outside the new dates, and still copies it", () => {
    const copy = copyTrip(
      source(),
      ["hotels", "plan", "flights", "bookings"],
      target({ endDate: "2027-03-05" }),
      NOW,
    );
    expect(copy.report.outside).toEqual([
      {
        part: "bookings",
        id: "flight-2027-02-27-1",
        date: "2027-02-27",
        name: "Tokyo",
        reservationType: "flight",
      },
      {
        part: "hotels",
        id: "tokyo-ueno-2027-03-01",
        date: "2027-03-01",
        name: "Sample Hotel Tokyo",
      },
      {
        part: "hotels",
        id: "nagoya-2027-03-08",
        date: "2027-03-08",
        name: "Sample Hotel Nagoya",
      },
      {
        part: "plan",
        id: "item-1",
        date: "2027-03-09",
        name: "Nagoya Castle",
      },
    ]);
    // Landing the day the trip starts is normal for a flight.
    expect(copy.records.flights).toHaveLength(1);
    expect(copy.records.stays).toHaveLength(2);
  });

  it("copies holidays only when the dates don't move", () => {
    const moved = copyTrip(source(), ["holidays"], target(), NOW);
    expect(moved.records.holidays).toEqual([]);
    expect(moved.report.parts).toEqual([]);
    expect(availableParts(source(), target())).not.toContain("holidays");

    const same = target({ startDate: "2026-12-17", endDate: "2027-01-05" });
    const kept = copyTrip(source(), ["holidays"], same, NOW);
    expect(kept.records.holidays.map((h) => h.id)).toEqual([
      "holiday-2027-01-01",
    ]);
    expect(availableParts(source(), same)).toContain("holidays");
  });

  it("resets the to-dos and moves their due dates", () => {
    const copy = copyTrip(source(), ["todos"], target(), NOW);
    expect(copy.records.todoLists).toEqual([
      { ...list, updatedAt: NOW.toISOString() },
    ]);
    expect(copy.records.todos).toEqual([
      {
        ...todo,
        status: "todo",
        completedAt: null,
        assignee: null,
        dueDate: "2027-02-22",
        updatedAt: NOW.toISOString(),
      },
    ]);
    expect(copy.report.counts.todos).toBe(1);
    expect(copy.report.lists).toBe(1);
  });

  it("keeps assignees and per-member targets only with the members", () => {
    const without = copyTrip(source(), ["todos", "budget"], target(), NOW);
    expect(without.changes.budget).toEqual({
      totalJPY: 800000,
      byCategory: { food: 100000 },
      travellers: 2,
      byMember: {},
    });
    expect(without.changes.members).toBeUndefined();

    const withMembers = copyTrip(
      source(),
      ["todos", "budget", "members"],
      target(),
      NOW,
    );
    expect(withMembers.records.todos[0].assignee).toBe("ben@example.com");
    expect(withMembers.changes.members).toEqual([ME, "ben@example.com"]);
    expect(withMembers.changes.budget?.byMember).toEqual({
      [ME]: 400000,
      "ben@example.com": 400000,
    });
    expect(withMembers.report.counts.members).toBe(1);
  });

  it("merges the members up to the limit, keeping the person copying", () => {
    const many = Array.from({ length: 25 }, (_, i) => `person${i}@example.com`);
    const copy = copyTrip(
      source({ members: many }),
      ["members"],
      target({ members: ["Cora@Example.com"] }),
      NOW,
    );
    const members = copy.changes.members ?? [];
    expect(members).toHaveLength(MAX_MEMBERS);
    expect(members.slice(0, 2)).toEqual([ME, "cora@example.com"]);
    expect(copy.report.counts.members).toBe(MAX_MEMBERS - 2);
    expect(copy.report.membersLeftOut).toBe(25 - (MAX_MEMBERS - 2));
  });

  it("never copies expenses, cash or archived records", () => {
    const copy = copyTrip(source(), COPY_PARTS, target(), NOW);
    expect(copy.records.expenses).toEqual([]);
    expect(copy.records.cash).toEqual([]);
    const all = [
      ...copy.records.cities,
      ...copy.records.stays,
      ...copy.records.places,
    ];
    expect(all.every((r) => !r.archived)).toBe(true);
    expect(copy.records.cities.map((c) => c.id)).not.toContain("osaka");
  });

  it("returns records the schemas accept, and leaves the source as it was", () => {
    const from = source();
    const before = structuredClone(from);
    const copy = copyTrip(
      from,
      COPY_PARTS,
      target({ startDate: "2026-12-17", endDate: "2027-01-05" }),
      NOW,
    );
    expect(TripDataSchema.parse(copy.records)).toEqual(copy.records);
    for (const planItem of copy.items) PlanItemSchema.parse(planItem);
    expect(copy.changes.budget).toEqual(
      BudgetSchema.parse(copy.changes.budget),
    );
    expect(from).toEqual(before);
    expect(copy.report.counts).toEqual({
      cities: 2,
      places: 1,
      hotels: 2,
      flights: 1,
      bookings: 1,
      plan: 1,
      budget: 1,
      todos: 1,
      holidays: 1,
      members: 1,
    });
  });
});
