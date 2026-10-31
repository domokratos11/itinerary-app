import type { TripDay } from "./days";
import {
  EXPENSE_CATEGORIES,
  type Budget,
  type Category,
  type ExpenseCategory,
  type ExpenseRecord,
  type Place,
  type PlanItem,
  type Reservation,
} from "./schemas";

export const EMPTY_BUDGET: Budget = {
  totalJPY: null,
  byCategory: {},
  travellers: null,
};

export function formatYen(yen: number): string {
  return `¥${yen.toLocaleString("en-US")}`;
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

export type PayerTotal = { paidBy: string | null; paid: number };

// What each person has paid so far, the most first. It doesn't settle up.
export function totalsByPayer(expenses: ExpenseRecord[]): PayerTotal[] {
  const totals = new Map<string | null, number>();
  for (const e of expenses)
    if (e.status === "paid")
      totals.set(e.paidBy, (totals.get(e.paidBy) ?? 0) + e.amountJPY);
  return [...totals]
    .map(([paidBy, paid]) => ({ paidBy, paid }))
    .sort((a, b) => b.paid - a.paid);
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
