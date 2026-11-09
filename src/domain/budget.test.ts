import { describe, expect, it } from "vitest";

import {
  categoryForPlace,
  categoryForReservation,
  daysRemaining,
  estimateStops,
  filterExpenses,
  formatYen,
  NO_FILTER,
  personDetails,
  spendByDay,
  summarizeBudget,
  totalsByCategory,
  totalsByMember,
  totalsByPayer,
} from "./budget";
import type { TripDay } from "./days";
import { ExpenseRecordSchema, type PlanItem } from "./schemas";

const expense = (over: Record<string, unknown>) =>
  ExpenseRecordSchema.parse({
    id: "e1",
    title: "Lunch",
    amountJPY: 1000,
    category: "food",
    date: "2026-12-16",
    status: "paid",
    paidBy: "ana@example.com",
    note: null,
    archived: false,
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...over,
  });

const stop = (placeId: string, status: PlanItem["status"]): PlanItem => ({
  id: `i-${placeId}`,
  placeId,
  date: "2026-12-16",
  order: "a0",
  status,
  updatedAt: "2026-11-01T00:00:00.000Z",
});

const day = (date: string): TripDay => ({ date, cityIds: [], stays: [] });

const prices = new Map([
  ["zoo", { costEstimateJPY: 600 }],
  ["free", { costEstimateJPY: 0 }],
  ["unknown", { costEstimateJPY: null }],
]);

describe("categories", () => {
  it("starts from what the place or booking is", () => {
    expect(categoryForPlace("shopping")).toBe("souvenirs");
    expect(categoryForPlace("lights")).toBe("attractions");
    expect(categoryForReservation("hotel")).toBe("booking");
    expect(categoryForReservation("train")).toBe("transport");
  });
});

describe("estimateStops", () => {
  it("multiplies per-adult prices and keeps unknown prices apart", () => {
    const items = [stop("zoo", "planned"), stop("unknown", "planned")];
    expect(estimateStops(items, prices, [], 2)).toEqual({
      yen: 1200,
      unpriced: 1,
    });
  });

  it("counts a free place as free, not as unknown", () => {
    expect(estimateStops([stop("free", "planned")], prices, [], 2)).toEqual({
      yen: 0,
      unpriced: 0,
    });
  });

  it("leaves out skipped and removed stops", () => {
    const items = [stop("zoo", "skipped"), stop("unknown", "removed")];
    expect(estimateStops(items, prices, [], 2)).toEqual({
      yen: 0,
      unpriced: 0,
    });
  });

  it("doesn't count a place twice when an expense points at it", () => {
    const logged = [expense({ placeId: "zoo", amountJPY: 700 })];
    expect(estimateStops([stop("zoo", "done")], prices, logged, 2)).toEqual({
      yen: 0,
      unpriced: 0,
    });
  });
});

describe("summarizeBudget", () => {
  const input = {
    items: [stop("zoo", "planned")],
    placesById: prices,
    memberCount: 2,
    remainingDays: 10,
  };

  it("works out spent, committed, forecast and what's left", () => {
    const summary = summarizeBudget({
      ...input,
      expenses: [
        expense({ amountJPY: 30000 }),
        expense({ id: "e2", amountJPY: 20000, status: "planned" }),
      ],
      budget: {
        totalJPY: 100000,
        byCategory: {},
        travellers: null,
        byMember: {},
      },
    });
    expect(summary).toMatchObject({
      spent: 30000,
      committed: 50000,
      estimated: 1200,
      forecast: 51200,
      left: 70000,
      over: 0,
      safePerDay: 7000,
      travellers: 2,
    });
  });

  it("reports the overspend instead of a negative balance", () => {
    const summary = summarizeBudget({
      ...input,
      expenses: [expense({ amountJPY: 120000 })],
      budget: {
        totalJPY: 100000,
        byCategory: {},
        travellers: 3,
        byMember: {},
      },
    });
    expect(summary).toMatchObject({
      left: 0,
      over: 20000,
      safePerDay: null,
      travellers: 3,
    });
  });

  it("has no balance with no budget set", () => {
    const summary = summarizeBudget({
      ...input,
      expenses: [],
      budget: null,
    });
    expect(summary).toMatchObject({ budget: null, left: null, over: 0 });
  });
});

describe("totals", () => {
  it("gives every category a row in the fixed order", () => {
    const rows = totalsByCategory(
      [
        expense({ amountJPY: 500 }),
        expense({ id: "e2", amountJPY: 300, status: "planned" }),
      ],
      {
        totalJPY: null,
        byCategory: { food: 900 },
        travellers: null,
        byMember: {},
      },
    );
    expect(rows[0].category).toBe("flight");
    expect(rows.find((r) => r.category === "food")).toEqual({
      category: "food",
      paid: 500,
      planned: 300,
      target: 900,
    });
  });

  it("adds up what each person paid, the most first", () => {
    expect(
      totalsByPayer([
        expense({ amountJPY: 100 }),
        expense({ id: "e2", amountJPY: 400, paidBy: "bo@example.com" }),
        expense({ id: "e3", amountJPY: 900, status: "planned" }),
      ]),
    ).toEqual([
      { paidBy: "bo@example.com", paid: 400 },
      { paidBy: "ana@example.com", paid: 100 },
    ]);
  });

  it("puts an expense with no payer on the trip's first member", () => {
    expect(
      totalsByPayer(
        [expense({ paidBy: null }), expense({ id: "e2", amountJPY: 50 })],
        ["ana@example.com", "bo@example.com"],
      ),
    ).toEqual([{ paidBy: "ana@example.com", paid: 1050 }]);
  });

  it("gives every member a row against their own target", () => {
    const rows = totalsByMember(
      [
        expense({ amountJPY: 500 }),
        expense({ id: "e2", amountJPY: 300, status: "planned" }),
        expense({ id: "e3", amountJPY: 70, paidBy: "old@example.com" }),
      ],
      ["ana@example.com", "bo@example.com"],
      {
        totalJPY: null,
        byCategory: {},
        travellers: null,
        byMember: { "bo@example.com": 2000 },
      },
    );
    expect(rows).toEqual([
      { email: "ana@example.com", paid: 500, planned: 300, target: null },
      { email: "bo@example.com", paid: 0, planned: 0, target: 2000 },
      { email: "old@example.com", paid: 70, planned: 0, target: null },
    ]);
  });
});

describe("personDetails", () => {
  it("splits what one person paid by category and by card or cash", () => {
    const details = personDetails(
      [
        expense({ amountJPY: 500, paymentMethod: "cash" }),
        expense({ id: "e2", amountJPY: 200, category: "transport" }),
        expense({ id: "e3", amountJPY: 900, status: "planned" }),
        expense({ id: "e4", amountJPY: 40, paidBy: "bo@example.com" }),
      ],
      "ana@example.com",
      ["ana@example.com"],
    );
    expect(details).toEqual({
      paid: 700,
      planned: 900,
      byCard: 200,
      byCash: 500,
      count: 3,
      categories: [
        { category: "transport", paid: 200 },
        { category: "food", paid: 500 },
      ],
    });
  });
});

describe("filterExpenses", () => {
  const rows = [
    expense({ id: "a", amountJPY: 300, date: "2026-12-17" }),
    expense({
      id: "b",
      amountJPY: 900,
      date: "2026-12-16",
      paidBy: "bo@example.com",
      paymentMethod: "cash",
    }),
    expense({ id: "c", amountJPY: 100, date: "2026-12-18", status: "planned" }),
  ];
  const members = ["ana@example.com", "bo@example.com"];
  const ids = (list: { id: string }[]) => list.map((e) => e.id);

  it("sorts by date or amount", () => {
    expect(ids(filterExpenses(rows, NO_FILTER, "newest", members))).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(ids(filterExpenses(rows, NO_FILTER, "oldest", members))).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(ids(filterExpenses(rows, NO_FILTER, "highest", members))).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(ids(filterExpenses(rows, NO_FILTER, "lowest", members))).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("filters by person, payment and status together", () => {
    const only = (over: Partial<typeof NO_FILTER>) =>
      ids(filterExpenses(rows, { ...NO_FILTER, ...over }, "newest", members));
    expect(only({ person: "bo@example.com" })).toEqual(["b"]);
    expect(only({ method: "card" })).toEqual(["c", "a"]);
    expect(only({ person: "ana@example.com", status: "paid" })).toEqual(["a"]);
  });
});

describe("days", () => {
  const days = [day("2026-12-15"), day("2026-12-16"), day("2026-12-17")];

  it("counts today among the days remaining", () => {
    expect(daysRemaining("2026-11-01", days)).toBe(3);
    expect(daysRemaining("2026-12-16", days)).toBe(2);
    expect(daysRemaining("2027-01-01", days)).toBe(0);
  });

  it("keeps money paid before the trip apart from its days", () => {
    const result = spendByDay(
      [
        expense({ amountJPY: 100 }),
        expense({ id: "e2", amountJPY: 900, date: "2026-10-01" }),
      ],
      days,
    );
    expect(result.outside).toBe(900);
    expect(result.days[1]).toEqual({ date: "2026-12-16", paid: 100 });
  });
});

describe("formatYen", () => {
  it("groups thousands", () => {
    expect(formatYen(1234567)).toBe("¥1,234,567");
  });
});
