import { describe, expect, it } from "vitest";

import { parseYen, quickExpense } from "./quick-expense";
import type { Stay } from "./schemas";

const stay = (cityId: string, checkIn: string, checkOut: string): Stay => ({
  cityId,
  hotelName: cityId,
  hotelMapsUrl: null,
  lat: null,
  lng: null,
  checkIn,
  checkOut,
});
const stays = [
  stay("tokyo", "2026-12-15", "2026-12-20"),
  stay("kyoto", "2026-12-20", "2026-12-24"),
];
const tr = (key: string) => (key === "expenseCategory.food" ? "Food" : key);
const base = {
  id: "e1",
  amountJPY: 450,
  category: "food" as const,
  stays,
  paidBy: "ana@example.com",
  title: "",
  tr,
  now: new Date("2026-12-20T03:00:00.000Z"),
};

describe("parseYen", () => {
  it.each([
    ["450", 450],
    ["¥1,200", 1200],
    [" 3 000 ", 3000],
    ["", null],
    ["12.5", null],
    ["-5", null],
  ])("reads %j as %j", (text, yen) => {
    expect(parseYen(text)).toBe(yen);
  });
});

describe("quickExpense", () => {
  it("is paid today, in the city of tonight's hotel, named by category", () => {
    const e = quickExpense({
      ...base,
      date: "2026-12-20",
      today: "2026-12-20",
    });
    expect(e).toMatchObject({
      title: "Food",
      status: "paid",
      cityId: "kyoto",
      paidBy: "ana@example.com",
      stayId: null,
      date: "2026-12-20",
    });
  });

  it("keeps a typed name and plans a future day", () => {
    const e = quickExpense({
      ...base,
      title: "  Coffee ",
      date: "2026-12-22",
      today: "2026-12-20",
    });
    expect(e.title).toBe("Coffee");
    expect(e.status).toBe("planned");
  });

  it("has no city on a night without a hotel", () => {
    const e = quickExpense({
      ...base,
      date: "2027-01-02",
      today: "2027-01-02",
    });
    expect(e.cityId).toBeNull();
  });
});
