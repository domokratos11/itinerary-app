"use client";

import { useState } from "react";
import {
  Archive,
  ChevronRight,
  FileSpreadsheet,
  Pencil,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { PAYMENT_ICON, personLabel } from "@/components/expense-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tip } from "@/components/tip";
import { useAmountsHidden, useYenValues, Yen } from "@/components/yen";
import { Progress } from "@/components/ui/progress";
import {
  formatUsdAt,
  payerOf,
  type CategoryTotal,
  type MemberTotal,
} from "@/domain/budget";
import {
  EXPENSE_CATEGORIES,
  type Budget,
  type ExpenseRecord,
} from "@/domain/schemas";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { useActiveTrip } from "@/lib/auth-store";
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

// One member against their own target. Opens what they paid.
export function MemberTargetRow({
  row,
  onOpen,
}: {
  row: MemberTotal;
  onOpen: () => void;
}) {
  const money = useYenValues();
  const { email, paid, planned, target } = row;
  const name = personLabel(email);
  const over = target !== null && paid > target;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("budget.seePerson", { name })}
        className="-mx-2 flex w-[calc(100%+1rem)] flex-col gap-1 rounded-md px-2 py-1.5 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex w-full items-center gap-2">
          <User className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <span
            className={
              over
                ? "font-medium text-destructive tabular-nums"
                : "text-muted-foreground tabular-nums"
            }
          >
            {target === null
              ? money.format(paid)
              : t("budget.ofTarget", {
                  paid: money.format(paid),
                  target: money.format(target),
                })}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </span>
        {target !== null && (
          <Progress
            value={target > 0 ? Math.min(100, (paid / target) * 100) : 100}
            color={over ? "var(--destructive)" : "var(--primary)"}
            className="h-2 w-full"
            aria-label={name}
          />
        )}
        {planned > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("budget.plannedExtra", { planned: money.format(planned) })}
          </span>
        )}
      </button>
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
  const Method = PAYMENT_ICON[expense.paymentMethod];
  const hidden = useAmountsHidden();
  const members = useActiveTrip()?.members ?? [];
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
        <span className="flex flex-wrap items-center gap-x-1 text-muted-foreground">
          {formatDayLabel(expense.date)} ·{" "}
          {personLabel(payerOf(expense, members))} ·
          <Method className="size-3.5" aria-hidden />
          {t(`paymentMethod.${expense.paymentMethod}`)}
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
  const members = useActiveTrip()?.members ?? [];
  const [memberTargets, setMemberTargets] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(budget.byMember ?? {}).map(([e, v]) => [e, String(v)]),
    ),
  );
  const people = yenOrNull(travellers);
  const valid =
    validYen(yenOrNull(total)) &&
    (people === null ||
      (Number.isInteger(people) && people >= 1 && people <= 20)) &&
    EXPENSE_CATEGORIES.every((c) => validYen(yenOrNull(targets[c] ?? ""))) &&
    members.every((m) => validYen(yenOrNull(memberTargets[m] ?? "")));

  function save() {
    const byCategory: Budget["byCategory"] = {};
    for (const c of EXPENSE_CATEGORIES) {
      const value = yenOrNull(targets[c] ?? "");
      if (value !== null) byCategory[c] = value;
    }
    // Someone no longer on the trip keeps their target, out of sight.
    const byMember: Budget["byMember"] = Object.fromEntries(
      Object.entries(budget.byMember ?? {}).filter(
        ([email]) => !members.includes(email),
      ),
    );
    for (const m of members) {
      const value = yenOrNull(memberTargets[m] ?? "");
      if (value !== null) byMember[m] = value;
    }
    saveBudget(tripId, {
      totalJPY: yenOrNull(total),
      byCategory,
      travellers: people,
      byMember,
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
      {members.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">
            {t("budget.memberTargets")}
          </legend>
          <p className="-mt-2 text-xs text-muted-foreground">
            {t("budget.memberTargetsHint")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {members.map((m, i) => (
              <Field
                key={m}
                label={personLabel(m)}
                htmlFor={`budget-member-${i}`}
              >
                <Input
                  id={`budget-member-${i}`}
                  inputMode="numeric"
                  value={memberTargets[m] ?? ""}
                  onChange={(e) =>
                    setMemberTargets({ ...memberTargets, [m]: e.target.value })
                  }
                />
              </Field>
            ))}
          </div>
        </fieldset>
      )}
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
