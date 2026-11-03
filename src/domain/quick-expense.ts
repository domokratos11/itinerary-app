import type { Translate } from "./i18n";
import type { ExpenseCategory, ExpenseRecord, Stay } from "./schemas";
import { nightStay } from "./trip";

// The categories offered for a quick entry on the go, most used first.
// Flights and bookings are paid ahead and logged from their own screens.
export const QUICK_CATEGORIES: ExpenseCategory[] = [
  "food",
  "transport",
  "attractions",
  "souvenirs",
  "temples",
  "clothes",
  "other",
];

// The yen typed into a quick entry: digits, with commas, spaces or a yen sign
// allowed. Null for anything else, or nothing.
export function parseYen(text: string): number | null {
  const cleaned = text.replace(/[,\s¥￥]/g, "");
  if (!/^\d{1,9}$/.test(cleaned)) return null;
  return Number(cleaned);
}

// One expense from an amount and a category. The date is the day it's logged
// for (today in Tokyo, or the day page's date), and the city is where that
// night is spent.
export function quickExpense(input: {
  id: string;
  amountJPY: number;
  category: ExpenseCategory;
  date: string;
  today: string;
  stays: Stay[];
  paidBy: string | null;
  title: string;
  tr: Translate;
  now: Date;
}): ExpenseRecord {
  const stay = nightStay(input.date, input.stays);
  return {
    id: input.id,
    title:
      input.title.trim().slice(0, 200) ||
      input.tr(`expenseCategory.${input.category}`),
    amountJPY: input.amountJPY,
    category: input.category,
    date: input.date,
    status: input.date > input.today ? "planned" : "paid",
    paidBy: input.paidBy,
    placeId: null,
    reservationId: null,
    stayId: null,
    cityId: stay?.cityId ?? null,
    note: null,
    archived: false,
    updatedAt: input.now.toISOString(),
  };
}
