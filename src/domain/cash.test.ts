import { describe, expect, it } from "vitest";

import { summarizeCash } from "./cash";
import {
  CashRecordSchema,
  ExpenseRecordSchema,
  type CashRecord,
} from "./schemas";

const ANA = "ana@example.com";
const BO = "bo@example.com";

const move = (over: Partial<CashRecord>): CashRecord =>
  CashRecordSchema.parse({
    id: "c1",
    kind: "withdrawal",
    date: "2026-12-16",
    amountJPY: 20000,
    amountUSD: null,
    by: ANA,
    to: null,
    note: null,
    archived: false,
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...over,
  });

const spent = (over: Record<string, unknown>) =>
  ExpenseRecordSchema.parse({
    id: "e1",
    title: "Ramen",
    amountJPY: 3000,
    category: "food",
    date: "2026-12-16",
    status: "paid",
    paidBy: BO,
    paymentMethod: "cash",
    note: null,
    archived: false,
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...over,
  });

describe("summarizeCash", () => {
  it("follows cash from the ATM to a handover to a cash payment", () => {
    const summary = summarizeCash(
      [
        move({ amountUSD: 128.4 }),
        move({ id: "c2", kind: "handover", amountJPY: 10000, to: BO }),
      ],
      [spent({}), spent({ id: "e2", paymentMethod: "card", amountJPY: 900 })],
      [ANA, BO],
    );
    expect(summary.people).toEqual([
      {
        email: ANA,
        withdrawn: 20000,
        withdrawnUSD: 128.4,
        received: 0,
        given: 10000,
        spentCash: 0,
        onHand: 10000,
      },
      {
        email: BO,
        withdrawn: 0,
        withdrawnUSD: 0,
        received: 10000,
        given: 0,
        spentCash: 3000,
        onHand: 7000,
      },
    ]);
    expect(summary.debts).toEqual([{ from: BO, to: ANA, yen: 10000 }]);
    expect(summary.withdrawn).toBe(20000);
    expect(summary.missingUSD).toBe(0);
  });

  it("nets handovers between the same two people", () => {
    const { debts } = summarizeCash(
      [
        move({ id: "c1", kind: "handover", amountJPY: 10000, to: BO }),
        move({ id: "c2", kind: "handover", amountJPY: 4000, by: BO, to: ANA }),
      ],
      [],
      [ANA, BO],
    );
    expect(debts).toEqual([{ from: BO, to: ANA, yen: 6000 }]);
  });

  it("owes nothing once paid back in full", () => {
    const { debts } = summarizeCash(
      [
        move({ id: "c1", kind: "handover", amountJPY: 5000, to: BO }),
        move({ id: "c2", kind: "handover", amountJPY: 5000, by: BO, to: ANA }),
      ],
      [],
      [ANA, BO],
    );
    expect(debts).toEqual([]);
  });

  it("counts withdrawals still waiting for their dollars", () => {
    const summary = summarizeCash(
      [move({}), move({ id: "c2", amountUSD: 64.2 })],
      [],
      [ANA],
    );
    expect(summary.missingUSD).toBe(1);
    expect(summary.withdrawnUSD).toBe(64.2);
  });

  it("ignores planned and card spending", () => {
    const { people } = summarizeCash(
      [],
      [
        spent({ status: "planned" }),
        spent({ id: "e2", paymentMethod: "card" }),
      ],
      [BO],
    );
    expect(people[0].spentCash).toBe(0);
  });

  it("reads an expense saved before the payment method existed as card", () => {
    const old = ExpenseRecordSchema.parse({
      id: "e9",
      title: "Old",
      amountJPY: 100,
      category: "food",
      date: "2026-12-16",
      status: "paid",
      paidBy: ANA,
      note: null,
      archived: false,
      updatedAt: "2026-11-01T00:00:00.000Z",
    });
    expect(old.paymentMethod).toBe("card");
  });
});
