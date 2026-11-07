"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { Yen } from "@/components/yen";
import {
  daysRemaining,
  summarizeBudget,
  totalsByCategory,
  type BudgetSummary,
  type CategoryTotal,
} from "@/domain/budget";
import { type Budget, type ExpenseRecord } from "@/domain/schemas";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { useActiveTrip } from "@/lib/auth-store";
import { t } from "@/lib/i18n";
import { usePlanStore } from "@/lib/plan-store";
import { EXPENSE_ICON } from "@/lib/taxonomy-icons";
import { todayInTokyo } from "@/lib/tokyo-date";
import { usePlacesById, useTrip, useTripDays } from "@/lib/trip-store";

// The budget's figures and how they're shown; the Budget screen and the Dashboard both use them.

const noopSubscribe = () => () => {};

// The budget's figures from the live trip; the Dashboard uses them as well.
export function useBudgetFigures(): {
  summary: BudgetSummary;
  categories: CategoryTotal[];
  expenses: ExpenseRecord[];
  budget: Budget | null;
} {
  const trip = useActiveTrip();
  const expenses = useTrip().expenses;
  const items = usePlanStore((s) => s.items);
  const placesById = usePlacesById();
  const days = useTripDays();
  const today = useSyncExternalStore(noopSubscribe, todayInTokyo, () => null);
  const budget = trip?.budget ?? null;
  const memberCount = trip?.members.length ?? 1;
  return useMemo(
    () => ({
      expenses,
      budget,
      categories: totalsByCategory(expenses, budget),
      summary: summarizeBudget({
        expenses,
        items,
        placesById,
        budget,
        memberCount,
        remainingDays: today ? daysRemaining(today, days) : 0,
      }),
    }),
    [expenses, items, placesById, budget, memberCount, today, days],
  );
}

export function categorySeries(categories: CategoryTotal[]) {
  return categories.map(({ category, paid }) => ({
    key: category,
    label: t(`expenseCategory.${category}`),
    value: paid,
    color: EXPENSE_COLOR[category],
    icon: EXPENSE_ICON[category],
  }));
}

export function spentPercent({ spent, budget }: BudgetSummary): number {
  return budget ? (spent / budget) * 100 : 0;
}

// The amount in the middle of the budget ring.
export function GaugeCenter({ summary }: { summary: BudgetSummary }) {
  const over = summary.over > 0;
  return (
    <>
      <span className="text-xl font-semibold tabular-nums">
        <Yen yen={over ? summary.over : (summary.left ?? summary.spent)} />
      </span>
      <span className="text-xs text-muted-foreground">
        {over
          ? t("budget.overBy")
          : summary.left === null
            ? t("budget.spent")
            : t("budget.left")}
      </span>
    </>
  );
}

export function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function SummaryFigures({ summary }: { summary: BudgetSummary }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Figure
        label={t("budget.budget")}
        value={
          summary.budget === null ? (
            t("budget.notSet")
          ) : (
            <Yen yen={summary.budget} />
          )
        }
      />
      <Figure label={t("budget.spent")} value={<Yen yen={summary.spent} />} />
      <Figure
        label={t("budget.committed")}
        value={<Yen yen={summary.committed} />}
        hint={t("budget.committedHint")}
      />
      <Figure
        label={t("budget.forecast")}
        value={<Yen yen={summary.forecast} />}
        hint={
          summary.unpriced > 0
            ? t("budget.forecastUnpriced", { count: summary.unpriced })
            : t("budget.forecastHint")
        }
      />
      {summary.safePerDay !== null && (
        <Figure
          label={t("budget.safePerDay")}
          value={<Yen yen={summary.safePerDay} />}
        />
      )}
    </div>
  );
}
