"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  LayoutGrid,
  Plus,
  Target,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { BudgetGauge, DonutChart } from "@/components/charts-lazy";
import {
  ExpenseCategoryOption,
  ExpenseForm,
  PAYMENT_ICON,
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
import {
  EMPTY_BUDGET,
  EXPENSE_SORTS,
  filterExpenses,
  NO_FILTER,
  totalsByMember,
  type ExpenseFilter,
  type ExpenseSort,
} from "@/domain/budget";
import { summarizeCash } from "@/domain/cash";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type ExpenseRecord,
} from "@/domain/schemas";
import { useActiveTrip } from "@/lib/auth-store";
import { t } from "@/lib/i18n";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip } from "@/lib/trip-store";
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
  MemberTargetRow,
  TargetRow,
} from "@/components/budget-parts";
import { PersonPanel } from "@/components/budget-person";
import { CashSection } from "@/components/cash-section";

// The trip's shared money: what's set aside, what has gone, on what and who
// paid it, and the cash that moves between people without being spent.
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
  const tripMembers = useActiveTrip()?.members;
  const members = useMemo(() => tripMembers ?? [], [tripMembers]);
  const cash = useTrip().cash;
  const { summary, categories, expenses, budget } = useBudgetFigures();
  const [editing, setEditing] = useState<{
    expense: ExpenseRecord | null;
  } | null>(null);
  const [settingTargets, setSettingTargets] = useState(false);
  const [filter, setFilter] = useState<ExpenseFilter>(NO_FILTER);
  const [sort, setSort] = useState<ExpenseSort>("newest");
  const [person, setPerson] = useState<string | null>(null);

  const visible = filterExpenses(expenses, filter, sort, members);
  const memberRows = totalsByMember(expenses, members, budget);
  const cashSummary = useMemo(
    () => summarizeCash(cash, expenses, members),
    [cash, expenses, members],
  );
  const percent = spentPercent(summary);
  const personRow = memberRows.find((r) => r.email === person) ?? null;
  const people = memberRows.map((r) => r.email);
  const narrowed = Object.entries(filter).some(([, v]) => v !== "all");

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
          <h1 className="text-3xl font-bold">{t("budget.title")}</h1>
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
            <CardTitle className="text-base">{t("budget.byMember")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {memberRows.map((row) => (
                <MemberTargetRow
                  key={row.email}
                  row={row}
                  onOpen={() => setPerson(row.email)}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("budget.expenses")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={filter.status}
              onValueChange={(v) =>
                v &&
                setFilter({ ...filter, status: v as ExpenseFilter["status"] })
              }
              aria-label={t("budget.status")}
              className="col-span-2 w-full sm:w-fit"
            >
              <ToggleGroupItem value="all" className="flex-1">
                {t("cities.all")}
              </ToggleGroupItem>
              <ToggleGroupItem value="paid" className="flex-1">
                {t("budget.paid")}
              </ToggleGroupItem>
              <ToggleGroupItem value="planned" className="flex-1">
                {t("budget.planned")}
              </ToggleGroupItem>
            </ToggleGroup>
            <Select
              value={filter.person}
              onValueChange={(v) => setFilter({ ...filter, person: v })}
            >
              <SelectTrigger
                className="w-full sm:w-fit sm:min-w-36"
                aria-label={t("budget.person")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <Users />
                  {t("budget.allPeople")}
                </SelectItem>
                {people.map((email) => (
                  <SelectItem key={email} value={email}>
                    <User />
                    {personLabel(email)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filter.method}
              onValueChange={(v) =>
                setFilter({ ...filter, method: v as ExpenseFilter["method"] })
              }
            >
              <SelectTrigger
                className="w-full sm:w-fit sm:min-w-36"
                aria-label={t("budget.payment")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <Wallet />
                  {t("budget.allMethods")}
                </SelectItem>
                {PAYMENT_METHODS.map((m) => {
                  const Icon = PAYMENT_ICON[m];
                  return (
                    <SelectItem key={m} value={m}>
                      <Icon />
                      {t(`paymentMethod.${m}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select
              value={filter.category}
              onValueChange={(v) =>
                setFilter({
                  ...filter,
                  category: v as ExpenseFilter["category"],
                })
              }
            >
              <SelectTrigger
                className="w-full sm:w-fit sm:min-w-44"
                aria-label={t("common.category")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <LayoutGrid />
                  {t("budget.allCategories")}
                </SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    <ExpenseCategoryOption category={c} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as ExpenseSort)}
            >
              <SelectTrigger
                className="w-full sm:ml-auto sm:w-fit sm:min-w-44"
                aria-label={t("budget.sort")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_SORTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    <ArrowDownUp />
                    {t(`expenseSort.${s}`)}
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
            <>
              {narrowed && (
                <p className="text-xs text-muted-foreground">
                  {t("budget.personCount", { count: visible.length })}
                </p>
              )}
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
            </>
          )}
        </CardContent>
      </Card>

      {tripId && (
        <CashSection
          tripId={tripId}
          cash={cash}
          summary={cashSummary}
          members={members}
        />
      )}

      {/* The details step aside while an expense is edited from them, so two
          panels never stack, and come back when it closes. */}
      <PersonPanel
        person={personRow}
        open={personRow !== null && editing === null}
        expenses={expenses}
        members={members}
        cash={cashSummary.people.find((p) => p.email === person) ?? null}
        onOpenChange={(open) => !open && setPerson(null)}
        onEdit={(expense) => setEditing({ expense })}
        onArchive={archive}
        onShowInList={(email) => {
          setFilter({ ...NO_FILTER, person: email });
          setPerson(null);
        }}
      />

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
