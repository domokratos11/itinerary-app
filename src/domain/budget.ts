import type { TripDay } from "./days";
import {
  EXPENSE_CATEGORIES,
  type Budget,
  type Category,
  type ExpenseCategory,
  type ExpenseRecord,
  type ExpenseStatus,
  type PaymentMethod,
  type Place,
  type PlanItem,
  type Reservation,
} from "./schemas";

export const EMPTY_BUDGET: Budget = {
  totalJPY: null,
  byCategory: {},
  travellers: null,
  byMember: {},
};

export function formatYen(yen: number): string {
  return `¥${yen.toLocaleString("en-US")}`;
}

// Shown for any amount while they're hidden. One fixed length, so it doesn't
// give away how big a number is.
export const HIDDEN_AMOUNT = "¥****";

// A fixed rate, only for the rough dollar hint: amounts stay in yen. Change it
// here when the rate moves.
export const YEN_PER_USD = 157.58;

export function formatUsd(yen: number): string {
  return (yen / YEN_PER_USD).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// Dollars as they are shown when the budget is viewed in USD, at a given rate.
export function formatUsdAt(yen: number, rate: number): string {
  return (yen / rate).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// A dollar amount converted to whole yen, as it's saved.
export function usdToYen(usd: number, rate: number): number {
  return Math.round(usd * rate);
}

// An amount typed in dollars ("$1,234.50"), or null when it isn't one. At
// most cents.
export function parseUsd(text: string): number | null {
  const clean = text.replace(/[,\s$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

// A rate typed as yen per dollar, or null when it isn't a positive number.
export function parseRate(text: string): number | null {
  const clean = text.replace(/[,\s¥]/g, "");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const rate = Number(clean);
  return rate > 0 ? rate : null;
}

// The spending category a place, booking or hotel starts out with.
export function categoryForPlace(category: Category): ExpenseCategory {
  if (category === "food") return "food";
  if (category === "shopping") return "souvenirs";
  if (category === "temple") return "temples";
  return "attractions";
}

export function categoryForReservation(
  type: Reservation["type"],
): ExpenseCategory {
  if (type === "flight") return "flight";
  if (type === "train") return "transport";
  if (type === "ticket") return "attractions";
  return "booking";
}

const sum = (expenses: ExpenseRecord[]) =>
  expenses.reduce((total, e) => total + e.amountJPY, 0);

export type CategoryTotal = {
  category: ExpenseCategory;
  paid: number;
  planned: number;
  target: number | null;
};

// One row per category, in the fixed order, so colours never move.
export function totalsByCategory(
  expenses: ExpenseRecord[],
  budget: Budget | null,
): CategoryTotal[] {
  return EXPENSE_CATEGORIES.map((category) => {
    const own = expenses.filter((e) => e.category === category);
    return {
      category,
      paid: sum(own.filter((e) => e.status === "paid")),
      planned: sum(own.filter((e) => e.status === "planned")),
      target: budget?.byCategory[category] ?? null,
    };
  });
}

// Who paid an expense. One saved without a payer counts as the trip's first
// member, the person who made the trip.
export function payerOf(
  expense: Pick<ExpenseRecord, "paidBy">,
  members: readonly string[],
): string | null {
  return expense.paidBy ?? members[0] ?? null;
}

export type PayerTotal = { paidBy: string | null; paid: number };

// What each person has paid so far, the most first. It doesn't settle up.
export function totalsByPayer(
  expenses: ExpenseRecord[],
  members: readonly string[] = [],
): PayerTotal[] {
  const totals = new Map<string | null, number>();
  for (const e of expenses) {
    if (e.status !== "paid") continue;
    const who = payerOf(e, members);
    totals.set(who, (totals.get(who) ?? 0) + e.amountJPY);
  }
  return [...totals]
    .map(([paidBy, paid]) => ({ paidBy, paid }))
    .sort((a, b) => b.paid - a.paid);
}

export type MemberTotal = {
  email: string;
  paid: number;
  planned: number;
  target: number | null;
};

// One row per member, in the members' order, against their own target. Only
// who paid counts, whatever it was for. Someone who paid but has left the
// trip still gets a row at the end, so no money goes missing.
export function totalsByMember(
  expenses: ExpenseRecord[],
  members: readonly string[],
  budget: Budget | null,
): MemberTotal[] {
  const people = [...members];
  for (const e of expenses) {
    const who = payerOf(e, members);
    if (who !== null && !people.includes(who)) people.push(who);
  }
  return people.map((email) => {
    const own = expenses.filter((e) => payerOf(e, members) === email);
    return {
      email,
      paid: sum(own.filter((e) => e.status === "paid")),
      planned: sum(own.filter((e) => e.status === "planned")),
      target: budget?.byMember?.[email] ?? null,
    };
  });
}

export type PersonDetails = {
  paid: number;
  planned: number;
  byCard: number;
  byCash: number;
  count: number;
  // Paid, by category in the fixed order; categories with nothing left out.
  categories: { category: ExpenseCategory; paid: number }[];
};

// What one person paid, for their details panel.
export function personDetails(
  expenses: ExpenseRecord[],
  email: string,
  members: readonly string[],
): PersonDetails {
  const own = expenses.filter((e) => payerOf(e, members) === email);
  const paid = own.filter((e) => e.status === "paid");
  return {
    paid: sum(paid),
    planned: sum(own.filter((e) => e.status === "planned")),
    byCard: sum(paid.filter((e) => e.paymentMethod === "card")),
    byCash: sum(paid.filter((e) => e.paymentMethod === "cash")),
    count: own.length,
    categories: EXPENSE_CATEGORIES.map((category) => ({
      category,
      paid: sum(paid.filter((e) => e.category === category)),
    })).filter((row) => row.paid > 0),
  };
}

export const EXPENSE_SORTS = ["newest", "oldest", "highest", "lowest"] as const;
export type ExpenseSort = (typeof EXPENSE_SORTS)[number];

export type ExpenseFilter = {
  status: ExpenseStatus | "all";
  category: ExpenseCategory | "all";
  person: string | "all";
  method: PaymentMethod | "all";
};

export const NO_FILTER: ExpenseFilter = {
  status: "all",
  category: "all",
  person: "all",
  method: "all",
};

// The expenses that match every filter, in the chosen order. Ties keep the
// newest change first, so the order never jumps.
export function filterExpenses(
  expenses: ExpenseRecord[],
  filter: ExpenseFilter,
  sort: ExpenseSort,
  members: readonly string[],
): ExpenseRecord[] {
  const byDate = (a: ExpenseRecord, b: ExpenseRecord) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  const byChange = (a: ExpenseRecord, b: ExpenseRecord) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
  const order: Record<
    ExpenseSort,
    (a: ExpenseRecord, b: ExpenseRecord) => number
  > = {
    newest: (a, b) => byDate(b, a),
    oldest: byDate,
    highest: (a, b) => b.amountJPY - a.amountJPY,
    lowest: (a, b) => a.amountJPY - b.amountJPY,
  };
  return expenses
    .filter(
      (e) =>
        (filter.status === "all" || e.status === filter.status) &&
        (filter.category === "all" || e.category === filter.category) &&
        (filter.method === "all" || e.paymentMethod === filter.method) &&
        (filter.person === "all" || payerOf(e, members) === filter.person),
    )
    .sort((a, b) => order[sort](a, b) || byChange(a, b));
}

export type StopEstimate = { yen: number; unpriced: number };

// What the stops still going ahead should cost: done and planned ones, not
// skipped or removed. Prices are per adult. A place with an expense pointing
// at it is already counted, and an unknown price is counted apart, never as
// free.
export function estimateStops(
  items: PlanItem[],
  placesById: ReadonlyMap<string, Pick<Place, "costEstimateJPY">>,
  expenses: ExpenseRecord[],
  travellers: number,
): StopEstimate {
  const logged = new Set(expenses.flatMap((e) => e.placeId ?? []));
  let yen = 0;
  let unpriced = 0;
  for (const item of items) {
    if (item.status !== "planned" && item.status !== "done") continue;
    if (logged.has(item.placeId)) continue;
    const cost = placesById.get(item.placeId)?.costEstimateJPY;
    if (cost === undefined || cost === null) unpriced += 1;
    else yen += cost * travellers;
  }
  return { yen, unpriced };
}

// Trip days from today on, today included. All of them before the trip.
export function daysRemaining(today: string, days: TripDay[]): number {
  return days.filter((d) => d.date >= today).length;
}

export type BudgetSummary = {
  budget: number | null;
  spent: number;
  committed: number;
  estimated: number;
  unpriced: number;
  forecast: number;
  // Budget minus spent; null with no budget set. Never below 0: see over.
  left: number | null;
  over: number;
  // What can go out per remaining day; null when that means nothing.
  safePerDay: number | null;
  travellers: number;
};

export function summarizeBudget(input: {
  expenses: ExpenseRecord[];
  items: PlanItem[];
  placesById: ReadonlyMap<string, Pick<Place, "costEstimateJPY">>;
  budget: Budget | null;
  memberCount: number;
  remainingDays: number;
}): BudgetSummary {
  const { expenses, budget } = input;
  const travellers = budget?.travellers ?? Math.max(1, input.memberCount);
  const spent = sum(expenses.filter((e) => e.status === "paid"));
  const committed = sum(expenses);
  const { yen: estimated, unpriced } = estimateStops(
    input.items,
    input.placesById,
    expenses,
    travellers,
  );
  const total = budget?.totalJPY ?? null;
  const left = total === null ? null : Math.max(0, total - spent);
  return {
    budget: total,
    spent,
    committed,
    estimated,
    unpriced,
    forecast: committed + estimated,
    left,
    over: total === null ? 0 : Math.max(0, spent - total),
    safePerDay:
      left !== null && left > 0 && input.remainingDays > 0
        ? Math.floor(left / input.remainingDays)
        : null,
    travellers,
  };
}

export type DaySpend = { date: string; paid: number };

// Paid money on each trip day. Whatever was paid outside the trip's days,
// such as flights booked months ahead, is returned apart.
export function spendByDay(
  expenses: ExpenseRecord[],
  days: TripDay[],
): { days: DaySpend[]; outside: number } {
  const dates = new Set(days.map((d) => d.date));
  const paid = expenses.filter((e) => e.status === "paid");
  return {
    days: days.map((d) => ({
      date: d.date,
      paid: sum(paid.filter((e) => e.date === d.date)),
    })),
    outside: sum(paid.filter((e) => !dates.has(e.date))),
  };
}
