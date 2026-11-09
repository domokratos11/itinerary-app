import { payerOf } from "./budget";
import type { CashRecord, ExpenseRecord } from "./schemas";

// Cash that moves without being spent. Withdrawals and handovers never reach
// the budget; spending in cash does, as an ordinary expense paid in cash.

export type CashPerson = {
  email: string;
  withdrawn: number;
  // Dollars the bank charged for the withdrawals that have them typed in.
  withdrawnUSD: number;
  received: number;
  given: number;
  spentCash: number;
  // Withdrawn and received, less what was handed on and paid in cash. Below
  // zero when cash was spent that came from somewhere else.
  onHand: number;
};

// One person owing another the net of what was handed between them.
export type CashDebt = { from: string; to: string; yen: number };

export type CashSummary = {
  people: CashPerson[];
  debts: CashDebt[];
  withdrawn: number;
  withdrawnUSD: number;
  // Withdrawals still waiting for their dollar amount.
  missingUSD: number;
};

// Cash on hand for each member, and who owes whom from the handovers. Cash
// expenses only lower the payer's cash; they never make anyone owe.
export function summarizeCash(
  cash: CashRecord[],
  expenses: ExpenseRecord[],
  members: readonly string[],
): CashSummary {
  const people = [...members];
  const add = (email: string | null) => {
    if (email !== null && !people.includes(email)) people.push(email);
  };
  for (const c of cash) {
    add(c.by);
    add(c.to);
  }

  const withdrawals = cash.filter((c) => c.kind === "withdrawal");
  const handovers = cash.filter((c) => c.kind === "handover" && c.to !== null);
  const cashPaid = expenses.filter(
    (e) => e.status === "paid" && e.paymentMethod === "cash",
  );
  const total = (rows: { amountJPY: number }[]) =>
    rows.reduce((sum, r) => sum + r.amountJPY, 0);
  const dollars = (rows: CashRecord[]) =>
    rows.reduce((sum, r) => sum + (r.amountUSD ?? 0), 0);

  const rows = people.map((email): CashPerson => {
    const mine = withdrawals.filter((c) => c.by === email);
    const withdrawn = total(mine);
    const received = total(handovers.filter((c) => c.to === email));
    const given = total(handovers.filter((c) => c.by === email));
    const spentCash = total(
      cashPaid.filter((e) => payerOf(e, members) === email),
    );
    return {
      email,
      withdrawn,
      withdrawnUSD: dollars(mine),
      received,
      given,
      spentCash,
      onHand: withdrawn + received - given - spentCash,
    };
  });

  // Handovers net out per pair: what came back cancels what went.
  const debts: CashDebt[] = [];
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i];
      const b = people[j];
      const net =
        total(handovers.filter((c) => c.by === a && c.to === b)) -
        total(handovers.filter((c) => c.by === b && c.to === a));
      if (net > 0) debts.push({ from: b, to: a, yen: net });
      if (net < 0) debts.push({ from: a, to: b, yen: -net });
    }

  return {
    people: rows.filter(
      (p) => members.includes(p.email) || p.withdrawn || p.received || p.given,
    ),
    debts: debts.sort((x, y) => y.yen - x.yen),
    withdrawn: total(withdrawals),
    withdrawnUSD: dollars(withdrawals),
    missingUSD: withdrawals.filter((c) => c.amountUSD === null).length,
  };
}
