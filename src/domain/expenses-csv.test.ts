import { describe, expect, it } from "vitest";

import { expensesCsv } from "./expenses-csv";
import type { CityRecord, ExpenseRecord, ReservationRecord } from "./schemas";
import { testPlace } from "./test-place";

const expense = (fields: Partial<ExpenseRecord>): ExpenseRecord => ({
  id: "e",
  title: "Lunch",
  amountJPY: 1200,
  category: "food",
  date: "2026-12-16",
  status: "paid",
  paidBy: "ana@example.com",
  placeId: null,
  reservationId: null,
  stayId: null,
  cityId: null,
  originalUSD: null,
  rateJPYPerUSD: null,
  paymentMethod: "card",
  note: null,
  archived: false,
  updatedAt: "2026-12-16T00:00:00.000Z",
  ...fields,
});

const tr = (key: string) => key.split(".").pop()!;
const cities = new Map<string, CityRecord>([
  [
    "tokyo",
    {
      id: "tokyo",
      name: "Tokyo",
      color: "#000000",
      archived: false,
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
]);
const train: ReservationRecord = {
  id: "shinkansen",
  type: "train",
  date: "2026-12-20",
  time: null,
  from: "Tokyo",
  to: "Kyoto",
  note: null,
  archived: false,
  updatedAt: "2026-10-01T00:00:00.000Z",
};
const zoo = testPlace({ id: "zoo", name: "Ueno Zoo" });
const lookups = {
  cities,
  places: new Map([[zoo.id, zoo]]),
  reservations: new Map([[train.id, train]]),
  person: (email: string | null) => email?.split("@")[0] ?? "nobody",
};

describe("expensesCsv", () => {
  const csv = expensesCsv(
    [
      expense({ id: "b", date: "2026-12-17", title: 'Tea, "matcha"' }),
      expense({ id: "a", cityId: "tokyo", placeId: "zoo", note: "=SUM(A1)" }),
      expense({ id: "x", archived: true, title: "Gone" }),
      expense({
        id: "t",
        date: "2026-12-20",
        title: "train · Tokyo · Kyoto",
        amountJPY: 15829,
        originalUSD: 100,
        rateJPYPerUSD: 158.29,
        reservationId: "shinkansen",
      }),
    ],
    lookups,
    tr,
  );
  const lines = csv.slice(1).split("\r\n");

  it("starts with a byte-order mark and a header", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe(
      "date,title,category,amountJPY,amountUSD,rate,status,paidBy,paymentMethod,city,place,booking,note",
    );
  });

  it("lists live expenses by date, quoting and guarding cells", () => {
    expect(lines[1]).toBe(
      "2026-12-16,Lunch,food,1200,,,paid,ana,card,Tokyo,Ueno Zoo,,'=SUM(A1)",
    );
    expect(lines[2]).toBe(
      '2026-12-17,"Tea, ""matcha""",food,1200,,,paid,ana,card,,,,',
    );
    expect(csv).not.toContain("Gone");
    expect(lines.at(-1)).toBe("");
  });

  it("keeps the dollars and rate, names the booking and raises the title", () => {
    expect(lines[3]).toBe(
      "2026-12-20,Train · Tokyo · Kyoto,food,15829,100,158.29,paid,ana,card,,,train · Tokyo · Kyoto,",
    );
  });
});
