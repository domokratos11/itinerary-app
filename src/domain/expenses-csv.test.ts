import { describe, expect, it } from "vitest";

import { expensesCsv } from "./expenses-csv";
import type { CityRecord, ExpenseRecord } from "./schemas";
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
const zoo = testPlace({ id: "zoo", name: "Ueno Zoo" });
const lookups = {
  cities,
  places: new Map([[zoo.id, zoo]]),
  person: (email: string | null) => email?.split("@")[0] ?? "nobody",
};

describe("expensesCsv", () => {
  const csv = expensesCsv(
    [
      expense({ id: "b", date: "2026-12-17", title: 'Tea, "matcha"' }),
      expense({ id: "a", cityId: "tokyo", placeId: "zoo", note: "=SUM(A1)" }),
      expense({ id: "x", archived: true, title: "Gone" }),
    ],
    lookups,
    tr,
  );
  const lines = csv.slice(1).split("\r\n");

  it("starts with a byte-order mark and a header", () => {
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(lines[0]).toBe(
      "date,title,category,amountJPY,status,paidBy,city,place,note",
    );
  });

  it("lists live expenses by date, quoting and guarding cells", () => {
    expect(lines[1]).toBe(
      "2026-12-16,Lunch,food,1200,paid,ana,Tokyo,Ueno Zoo,'=SUM(A1)",
    );
    expect(lines[2]).toBe('2026-12-17,"Tea, ""matcha""",food,1200,paid,ana,,,');
    expect(csv).not.toContain("Gone");
    expect(lines.at(-1)).toBe("");
  });
});
