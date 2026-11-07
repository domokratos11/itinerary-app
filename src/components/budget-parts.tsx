"use client";

import { useState } from "react";
import { Archive, FileSpreadsheet, Pencil } from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { personLabel } from "@/components/expense-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tip } from "@/components/tip";
import { useAmountsHidden, useYenValues, Yen } from "@/components/yen";
import { Progress } from "@/components/ui/progress";
import { formatUsdAt, type CategoryTotal } from "@/domain/budget";
import {
  EXPENSE_CATEGORIES,
  type Budget,
  type ExpenseRecord,
} from "@/domain/schemas";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { EXPENSE_ICON } from "@/lib/taxonomy-icons";
import { todayInTokyo } from "@/lib/tokyo-date";
import { saveBudget } from "@/lib/trip-actions";
import { useCitiesById, usePlacesById, useTrip } from "@/lib/trip-store";
import { expensesCsv } from "@/domain/expenses-csv";
import { capitalizeFirst } from "@/domain/text";

// Rows, the budget form and the CSV export of the Budget screen.

export function TargetRow({ row }: { row: CategoryTotal }) {
  const money = useYenValues();
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
          <Yen yen={paid}>
            {target === null
              ? money.format(paid)
              : t("budget.ofTarget", {
                  paid: money.format(paid),
                  target: money.format(target),
                })}
          </Yen>
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

export function ExpenseRow({
  expense,
  onEdit,
  onArchive,
}: {
  expense: ExpenseRecord;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const Icon = EXPENSE_ICON[expense.category];
  const hidden = useAmountsHidden();
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3 text-sm">
      <Icon
        className="mt-0.5 size-4 shrink-0"
        style={{ color: EXPENSE_COLOR[expense.category] }}
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium break-words">
          {capitalizeFirst(expense.title)}
        </span>
        <span className="block text-muted-foreground">
          {formatDayLabel(expense.date)} · {personLabel(expense.paidBy)}
        </span>
        {expense.note && <span className="block">{expense.note}</span>}
        {(expense.reservationId || expense.stayId) && (
          <Badge variant="secondary" className="mt-1">
            {expense.reservationId
              ? t("budget.forBooking")
              : t("budget.forStay")}
          </Badge>
        )}
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="font-medium tabular-nums">
          <Yen yen={expense.amountJPY} />
        </span>
        {!hidden &&
          expense.originalUSD !== null &&
          expense.rateJPYPerUSD !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("budget.enteredUsd", {
                usd: formatUsdAt(expense.originalUSD, 1),
                rate: expense.rateJPYPerUSD,
              })}
            </span>
          )}
        {expense.status === "planned" && (
          <Badge variant="outline">{t("budget.planned")}</Badge>
        )}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={
          hidden
            ? t("budget.showToEdit")
            : t("common.editName", { name: expense.title })
        }
        disabled={hidden}
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

export function BudgetForm({
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

// Downloads every expense as CSV, for a spreadsheet or for matching against
// card statements after the trip. Made in the browser; nothing is sent.
// It always holds the real amounts: asking for the file is asking for them.
export function ExportExpensesButton() {
  const trip = useTrip();
  const cities = useCitiesById();
  const places = usePlacesById();
  if (trip.expenses.length === 0) return null;

  function download() {
    const csv = expensesCsv(
      trip.expenses,
      {
        cities,
        places,
        reservations: new Map(trip.reservations.map((r) => [r.id, r])),
        person: personLabel,
      },
      t,
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `expenses-${todayInTokyo()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast(t("csv.exported"));
  }

  return (
    <Tip label={t("csv.tipExport")}>
      <Button variant="outline" onClick={download}>
        <FileSpreadsheet />
        {t("csv.export")}
      </Button>
    </Tip>
  );
}
