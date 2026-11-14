"use client";

import { useMemo } from "react";

import {
  BarList,
  SeriesLegend,
  StackedColumnChart,
  TargetsChart,
} from "@/components/charts-lazy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useYenValues } from "@/components/yen";
import {
  dailySpendByCategory,
  summarizeTargets,
  type CategoryTotal,
} from "@/domain/budget";
import type { ExpenseRecord } from "@/domain/schemas";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { EXPENSE_ICON } from "@/lib/taxonomy-icons";
import { useTripDays } from "@/lib/trip-store";

// The Budget screen's two summary charts: the category targets against what
// was spent, and what each trip day cost.

const categoryLabel = (c: CategoryTotal["category"]) =>
  t(`expenseCategory.${c}`);

// Each category's target next to its spending, then all the targets added up
// against the overall budget and the total spent. Targets don't have to add
// up to the budget, so the difference is only reported.
export function TargetsVsSpentCard({
  categories,
  budget,
}: {
  categories: CategoryTotal[];
  budget: number | null;
}) {
  const money = useYenValues();
  const summary = useMemo(
    () => summarizeTargets(categories, budget),
    [categories, budget],
  );
  const gap = budget === null ? null : summary.targets - budget;
  const totals = [
    {
      key: "targets",
      label: t("budget.targetsTotal"),
      value: summary.targets,
      color: "var(--muted-foreground)",
    },
    ...(budget === null
      ? []
      : [
          {
            key: "budget",
            label: t("budget.budget"),
            value: budget,
            color: "var(--primary)",
          },
        ]),
    {
      key: "spent",
      label: t("budget.spent"),
      value: summary.spent,
      color:
        budget !== null && summary.spent > budget
          ? "var(--destructive)"
          : "var(--chart-2)",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("budget.targetsVsSpent")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {summary.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("budget.noTargetsYet")}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <TargetsChart
                rows={summary.rows.map((row) => ({
                  key: row.category,
                  label: categoryLabel(row.category),
                  color: EXPENSE_COLOR[row.category],
                  target: row.target,
                  spent: row.paid,
                }))}
                targetName={t("budget.target")}
                spentName={t("budget.spent")}
                noTarget={t("budget.noTarget")}
                label={t("budget.targetsVsSpent")}
                {...money}
              />
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-3 w-5 rounded-sm bg-muted-foreground/25"
                  />
                  {t("budget.target")}
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-1.5 w-5 rounded-sm bg-primary"
                  />
                  {t("budget.spentLegend")}
                </li>
              </ul>
            </div>
            <BarList rows={totals} {...money} />
          </>
        )}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>
            {gap === null
              ? t("budget.targetsNoBudget")
              : gap > 0
                ? t("budget.targetsAbove", { yen: money.format(gap) })
                : gap < 0
                  ? t("budget.targetsBelow", { yen: money.format(-gap) })
                  : t("budget.targetsMatch")}
          </p>
          {summary.untargeted > 0 && (
            <p>
              {t("budget.untargeted", {
                yen: money.format(summary.untargeted),
              })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// "Tue, Dec 15" reads as just the date on a narrow axis.
const dayTick = (date: string) =>
  formatDayLabel(date).split(", ").at(-1) ?? date;

// What was paid on each trip day, stacked by category, without bookings and
// flights, so it shows the day-to-day spending.
export function DailySpendCard({ expenses }: { expenses: ExpenseRecord[] }) {
  const money = useYenValues();
  const days = useTripDays();
  const daily = useMemo(
    () => dailySpendByCategory(expenses, days),
    [expenses, days],
  );
  const series = daily.categories.map((category) => ({
    key: category,
    label: categoryLabel(category),
    color: EXPENSE_COLOR[category],
    icon: EXPENSE_ICON[category],
    value: daily.days.reduce((n, d) => n + (d.byCategory[category] ?? 0), 0),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("budget.perDay")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("budget.noDailySpend")}
          </p>
        ) : (
          <>
            <StackedColumnChart
              data={daily.days.map((d) => ({
                key: d.date,
                ...Object.fromEntries(
                  daily.categories.map((c) => [c, d.byCategory[c] ?? 0]),
                ),
              }))}
              series={series}
              label={t("budget.perDay")}
              tick={dayTick}
              {...money}
            />
            <SeriesLegend series={series} {...money} />
          </>
        )}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>{t("budget.perDayHint")}</p>
          {daily.outside > 0 && (
            <p>
              {t("budget.perDayOutside", { yen: money.format(daily.outside) })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
