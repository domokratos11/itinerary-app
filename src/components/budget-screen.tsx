"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";

import { BudgetGauge, DonutChart, BarList } from "@/components/charts-lazy";
import {
  ExpenseCategoryOption,
  ExpenseForm,
  personLabel,
} from "@/components/expense-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tip } from "@/components/tip";
import {
  CurrencyButton,
  HideAmountsButton,
  MoneyScope,
  useAmountsHidden,
  useYenValues,
} from "@/components/yen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EMPTY_BUDGET, totalsByPayer } from "@/domain/budget";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseRecord,
} from "@/domain/schemas";
import { t } from "@/lib/i18n";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTripId } from "@/lib/use-trip-id";
import { useReadOnly } from "@/lib/viewer-store";
import { NotOnSharedView } from "@/components/viewer";
import {
  categorySeries,
  GaugeCenter,
  spentPercent,
  SummaryFigures,
  useBudgetFigures,
} from "@/components/budget-figures";
import {
  BudgetForm,
  ExpenseRow,
  ExportExpensesButton,
  TargetRow,
} from "@/components/budget-parts";

// The trip's shared money: what's set aside, what has gone and on what.
export function BudgetScreen() {
  // A read-only link never shows money; this covers a typed address.
  if (useReadOnly()) return <NotOnSharedView />;
  return (
    <MoneyScope>
      <BudgetContent />
    </MoneyScope>
  );
}

function BudgetContent() {
  const tripId = useTripId();
  const money = useYenValues();
  const hidden = useAmountsHidden();
  const { summary, categories, expenses, budget } = useBudgetFigures();
  const [editing, setEditing] = useState<{
    expense: ExpenseRecord | null;
  } | null>(null);
  const [settingTargets, setSettingTargets] = useState(false);
  const [status, setStatus] = useState<"all" | "paid" | "planned">("all");
  const [category, setCategory] = useState<ExpenseCategory | "all">("all");

  const visible = expenses.filter(
    (e) =>
      (status === "all" || e.status === status) &&
      (category === "all" || e.category === category),
  );
  const payers = totalsByPayer(expenses);
  const percent = spentPercent(summary);

  function archive(expense: ExpenseRecord) {
    if (!tripId) return;
    const id = tripId;
    archiveRecord(
      id,
      "expenses",
      expense,
      t("activity.archivedExpense", { title: expense.title }),
    ).catch(() => toast.error(t("common.refused")));
    toast(t("common.archivedName", { name: expense.title }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(id, "expenses", expense).catch(() =>
            toast.error(t("common.refused")),
          ),
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{t("budget.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("budget.intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HideAmountsButton />
          <CurrencyButton />
          <ExportExpensesButton />
          {/* The form shows the real amounts, so it waits for them to show.
              The span keeps the hint working on a disabled button. */}
          <Tip
            label={hidden ? t("budget.showToEdit") : t("budget.tipSetBudget")}
          >
            <span className="inline-flex">
              <Button
                variant="outline"
                disabled={hidden}
                onClick={() => setSettingTargets(true)}
              >
                <Target />
                {t("budget.setBudget")}
              </Button>
            </span>
          </Tip>
          <Tip label={t("budget.tipAddExpense")}>
            <Button onClick={() => setEditing({ expense: null })}>
              <Plus />
              {t("budget.addExpense")}
            </Button>
          </Tip>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("budget.overview")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
            <BudgetGauge
              percent={percent}
              over={summary.over > 0}
              label={t("budget.gaugeLabel", {
                percent: Math.round(percent),
              })}
            >
              <GaugeCenter summary={summary} />
            </BudgetGauge>
            <SummaryFigures summary={summary} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("budget.byCategory")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.spent === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("budget.nothingPaid")}
              </p>
            ) : (
              <DonutChart
                series={categorySeries(categories)}
                center={money.format(summary.spent)}
                centerLabel={t("budget.spent")}
                label={t("budget.byCategory")}
                {...money}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("budget.targets")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {categories.map((row) => (
                <TargetRow key={row.category} row={row} />
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("budget.byPerson")}</CardTitle>
          </CardHeader>
          <CardContent>
            {payers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("budget.nothingPaid")}
              </p>
            ) : (
              <BarList
                rows={payers.map((p) => ({
                  key: p.paidBy ?? "nobody",
                  label: personLabel(p.paidBy),
                  value: p.paid,
                  color: "var(--primary)",
                }))}
                {...money}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("budget.expenses")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={status}
              onValueChange={(v) => v && setStatus(v as typeof status)}
              aria-label={t("budget.status")}
            >
              <ToggleGroupItem value="all">{t("cities.all")}</ToggleGroupItem>
              <ToggleGroupItem value="paid">{t("budget.paid")}</ToggleGroupItem>
              <ToggleGroupItem value="planned">
                {t("budget.planned")}
              </ToggleGroupItem>
            </ToggleGroup>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as typeof category)}
            >
              <SelectTrigger
                className="w-full min-w-44 sm:w-fit"
                aria-label={t("common.category")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("budget.allCategories")}</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    <ExpenseCategoryOption category={c} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {expenses.length === 0
                ? t("budget.noExpenses")
                : t("budget.noMatches")}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {visible.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onEdit={() => setEditing({ expense })}
                  onArchive={() => archive(expense)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing && tripId && (
        <ExpenseForm
          key={editing.expense?.id ?? "new"}
          tripId={tripId}
          expense={editing.expense}
          onClose={() => setEditing(null)}
        />
      )}
      {settingTargets && tripId && (
        <BudgetForm
          tripId={tripId}
          budget={budget ?? EMPTY_BUDGET}
          onClose={() => setSettingTargets(false)}
        />
      )}
    </div>
  );
}
