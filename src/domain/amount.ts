import { parseRate, parseUsd, usdToYen } from "./budget";
import { parseYen } from "./quick-expense";
import type { ExpenseRecord } from "./schemas";

export type EntryCurrency = "JPY" | "USD";

// What an amount box holds while it's typed in: yen, or dollars with a rate.
export type AmountEntry = {
  currency: EntryCurrency;
  amount: string;
  rate: string;
};

export type AmountResult = Pick<
  ExpenseRecord,
  "amountJPY" | "originalUSD" | "rateJPYPerUSD"
>;

// The saved amount from what was typed: yen as is, or dollars converted at
// the rate, keeping both. Null while it isn't a valid amount.
export function readAmount(entry: AmountEntry): AmountResult | null {
  if (entry.currency === "JPY") {
    const yen = parseYen(entry.amount);
    return yen === null
      ? null
      : { amountJPY: yen, originalUSD: null, rateJPYPerUSD: null };
  }
  const usd = parseUsd(entry.amount);
  const rate = parseRate(entry.rate);
  if (usd === null || rate === null) return null;
  return {
    amountJPY: usdToYen(usd, rate),
    originalUSD: usd,
    rateJPYPerUSD: rate,
  };
}

// How a saved amount reopens: in dollars with its own rate if it was entered
// that way, otherwise in yen with the current rate ready for a switch.
export function entryFor(
  saved: Partial<AmountResult> | null | undefined,
  currentRate: number,
): AmountEntry {
  if (saved?.originalUSD != null && saved.rateJPYPerUSD != null)
    return {
      currency: "USD",
      amount: String(saved.originalUSD),
      rate: String(saved.rateJPYPerUSD),
    };
  return {
    currency: "JPY",
    amount: saved?.amountJPY != null ? String(saved.amountJPY) : "",
    rate: String(currentRate),
  };
}
