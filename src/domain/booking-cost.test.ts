import { describe, expect, it } from "vitest";

import { bookingExpense, bookingLabel, linkedExpense } from "./booking-cost";
import type { ExpenseRecord, ReservationRecord } from "./schemas";

const tr = (key: string) =>
  ({ "reservationType.train": "Train", "reservationType.tour": "Tour" })[key] ??
  key;

const train: ReservationRecord = {
  id: "train-1",
  type: "train",
  date: "2026-12-20",
  time: "09:00",
  from: "Tokyo",
  to: "Kyoto",
  note: null,
  archived: false,
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const expense = (fields: Partial<ExpenseRecord>): ExpenseRecord => ({
  id: "e1",
  title: "Old",
  amountJPY: 1000,
  category: "other",
  date: "2026-12-01",
  status: "planned",
  paidBy: "ana@example.com",
  placeId: null,
  reservationId: "train-1",
  stayId: null,
  cityId: "tokyo",
  originalUSD: null,
  rateJPYPerUSD: null,
  note: "Card",
  archived: false,
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...fields,
});

const now = new Date("2026-11-03T00:00:00.000Z");

describe("bookingLabel", () => {
  it("names the type and the route", () => {
    expect(bookingLabel(train, tr)).toBe("Train · Tokyo · Kyoto");
    expect(bookingLabel({ type: "tour", from: null, to: null }, tr)).toBe(
      "Tour",
    );
  });
});

describe("linkedExpense", () => {
  it("finds the live expense for the booking", () => {
    const live = expense({ id: "live" });
    expect(
      linkedExpense(
        [
          expense({ id: "gone", archived: true }),
          live,
          expense({ reservationId: null }),
        ],
        "train-1",
      ),
    ).toBe(live);
    expect(linkedExpense([], "train-1")).toBeNull();
  });
});

describe("bookingExpense", () => {
  const amount = { amountJPY: 15829, originalUSD: 100, rateJPYPerUSD: 158.29 };

  it("makes a new expense from the booking", () => {
    const e = bookingExpense({
      reservation: train,
      existing: null,
      amount,
      status: "paid",
      paidBy: "bo@example.com",
      cityId: "tokyo",
      id: "new",
      tr,
      now,
    });
    expect(e).toMatchObject({
      id: "new",
      title: "Train · Tokyo · Kyoto",
      category: "transport",
      date: "2026-12-20",
      status: "paid",
      paidBy: "bo@example.com",
      reservationId: "train-1",
      amountJPY: 15829,
      originalUSD: 100,
      rateJPYPerUSD: 158.29,
    });
  });

  it("updates the linked one, keeping who paid, its note and category", () => {
    const e = bookingExpense({
      reservation: train,
      existing: expense({}),
      amount: { amountJPY: 14000, originalUSD: null, rateJPYPerUSD: null },
      status: "paid",
      paidBy: "bo@example.com",
      cityId: null,
      id: "unused",
      tr,
      now,
    });
    expect(e).toMatchObject({
      id: "e1",
      title: "Train · Tokyo · Kyoto",
      category: "other",
      date: "2026-12-20",
      amountJPY: 14000,
      originalUSD: null,
      paidBy: "ana@example.com",
      cityId: "tokyo",
      note: "Card",
    });
  });
});
