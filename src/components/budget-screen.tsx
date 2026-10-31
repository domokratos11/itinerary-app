"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Archive, Pencil, Plus, Target } from "lucide-react";
import { toast } from "sonner";

import { BudgetGauge, DonutChart, BarList } from "@/components/charts";
import { EditPanel, Field } from "@/components/edit-panel";
import {
  ExpenseCategoryOption,
  ExpenseForm,
  personLabel,
} from "@/components/expense-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  daysRemaining,
  EMPTY_BUDGET,
  formatYen,
  summarizeBudget,
  totalsByCategory,
  totalsByPayer,
  type BudgetSummary,
  type CategoryTotal,
} from "@/domain/budget";
import {
  EXPENSE_CATEGORIES,
  type Budget,
  type ExpenseCategory,
  type ExpenseRecord,
} from "@/domain/schemas";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { useActiveTrip } from "@/lib/auth-store";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { usePlanStore } from "@/lib/plan-store";
import { EXPENSE_ICON } from "@/lib/taxonomy-icons";
import { todayInTokyo } from "@/lib/tokyo-date";
import { archiveRecord, saveBudget, saveRecord } from "@/lib/trip-actions";
import { usePlacesById, useTrip, useTripDays } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

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
        {formatYen(over ? summary.over : (summary.left ?? summary.spent))}
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
  value: string;
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
          summary.budget === null
            ? t("budget.notSet")
            : formatYen(summary.budget)
        }
      />
      <Figure label={t("budget.spent")} value={formatYen(summary.spent)} />
      <Figure
        label={t("budget.committed")}
        value={formatYen(summary.committed)}
        hint={t("budget.committedHint")}
      />
      <Figure
        label={t("budget.forecast")}
        value={formatYen(summary.forecast)}
        hint={
          summary.unpriced > 0
            ? t("budget.forecastUnpriced", { count: summary.unpriced })
            : t("budget.forecastHint")
        }
      />
      {summary.safePerDay !== null && (
        <Figure
          label={t("budget.safePerDay")}
          value={formatYen(summary.safePerDay)}
        />
      )}
    </div>
  );
}

// The trip's shared money: what's set aside, what has gone and on what.
export function BudgetScreen() {
  const tripId = useTripId();
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
          <Button variant="outline" onClick={() => setSettingTargets(true)}>
            <Target />
            {t("budget.setBudget")}
          </Button>
          <Button onClick={() => setEditing({ expense: null })}>
            <Plus />
            {t("budget.addExpense")}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("budget.overview")}</CardTitle>
          </CardHeader>
          <CardContent className="grid items-center gap-4 sm:grid-cols-2">
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
                center={formatYen(summary.spent)}
                centerLabel={t("budget.spent")}
                label={t("budget.byCategory")}
                format={formatYen}
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
                format={formatYen}
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
                className="w-fit min-w-44"
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
            <ul className="grid gap-2 lg:grid-cols-2">
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

function TargetRow({ row }: { row: CategoryTotal }) {
  const { category, paid, target } = row;
  const Icon = EXPENSE_ICON[category];
  const color = EXPENSE_COLOR[category];
  const over = target !== null && paid > target;
  return (
    <li className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" style={{ color }} />
        <span className="min-w-0 flex-1 truncate">
          {t(`expenseCategory.${category}`)}
        </span>
        <span
          className={
            over
              ? "font-medium text-destructive tabular-nums"
              : "text-muted-foreground tabular-nums"
          }
        >
          {target === null
            ? formatYen(paid)
            : t("budget.ofTarget", {
                paid: formatYen(paid),
                target: formatYen(target),
              })}
        </span>
      </span>
      {target !== null && (
        <Progress
          value={target > 0 ? Math.min(100, (paid / target) * 100) : 100}
          color={over ? "var(--destructive)" : color}
          className="h-2"
          aria-label={t(`expenseCategory.${category}`)}
        />
      )}
    </li>
  );
}

function ExpenseRow({
  expense,
  onEdit,
  onArchive,
}: {
  expense: ExpenseRecord;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const Icon = EXPENSE_ICON[expense.category];
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3 text-sm">
      <Icon
        className="mt-0.5 size-4 shrink-0"
        style={{ color: EXPENSE_COLOR[expense.category] }}
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium break-words">{expense.title}</span>
        <span className="block text-muted-foreground">
          {formatDayLabel(expense.date)} · {personLabel(expense.paidBy)}
        </span>
        {expense.note && <span className="block">{expense.note}</span>}
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="font-medium tabular-nums">
          {formatYen(expense.amountJPY)}
        </span>
        {expense.status === "planned" && (
          <Badge variant="outline">{t("budget.planned")}</Badge>
        )}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("common.editName", { name: expense.title })}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("budget.archiveName", { name: expense.title })}
        onClick={onArchive}
      >
        <Archive />
      </Button>
    </li>
  );
}

const yenOrNull = (text: string): number | null => {
  const clean = text.replace(/[,\s¥]/g, "");
  return clean === "" ? null : Number(clean);
};
const validYen = (value: number | null) =>
  value === null || (Number.isInteger(value) && value >= 0);

function BudgetForm({
  tripId,
  budget,
  onClose,
}: {
  tripId: string;
  budget: Budget;
  onClose: () => void;
}) {
  const [total, setTotal] = useState(budget.totalJPY?.toString() ?? "");
  const [travellers, setTravellers] = useState(
    budget.travellers?.toString() ?? "",
  );
  const [targets, setTargets] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(budget.byCategory).map(([c, v]) => [c, String(v)]),
    ),
  );
  const people = yenOrNull(travellers);
  const valid =
    validYen(yenOrNull(total)) &&
    (people === null ||
      (Number.isInteger(people) && people >= 1 && people <= 20)) &&
    EXPENSE_CATEGORIES.every((c) => validYen(yenOrNull(targets[c] ?? "")));

  function save() {
    const byCategory: Budget["byCategory"] = {};
    for (const c of EXPENSE_CATEGORIES) {
      const value = yenOrNull(targets[c] ?? "");
      if (value !== null) byCategory[c] = value;
    }
    saveBudget(tripId, {
      totalJPY: yenOrNull(total),
      byCategory,
      travellers: people,
    }).catch(() => toast.error(t("common.refused")));
    onClose();
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("budget.setBudget")}
      description={t("budget.setBudgetHint")}
      canSubmit={valid}
      onSubmit={save}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("budget.total")} htmlFor="budget-total">
          <Input
            id="budget-total"
            inputMode="numeric"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </Field>
        <Field
          label={t("budget.travellers")}
          htmlFor="budget-travellers"
          hint={t("budget.travellersHint")}
        >
          <Input
            id="budget-travellers"
            inputMode="numeric"
            value={travellers}
            onChange={(e) => setTravellers(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {EXPENSE_CATEGORIES.map((c) => (
          <Field
            key={c}
            label={t(`expenseCategory.${c}`)}
            htmlFor={`budget-${c}`}
          >
            <Input
              id={`budget-${c}`}
              inputMode="numeric"
              value={targets[c] ?? ""}
              onChange={(e) => setTargets({ ...targets, [c]: e.target.value })}
            />
          </Field>
        ))}
      </div>
    </EditPanel>
  );
}
