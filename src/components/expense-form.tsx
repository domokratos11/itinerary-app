"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

import { AmountInput } from "@/components/amount-input";
import { EditPanel, Field } from "@/components/edit-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseRecord,
  type ExpenseStatus,
  type Place,
} from "@/domain/schemas";
import { entryFor, readAmount, type AmountEntry } from "@/domain/amount";
import { categoryForPlace } from "@/domain/budget";
import { nightStay } from "@/domain/trip";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { useActiveTrip, useAuthStore } from "@/lib/auth-store";
import { t } from "@/lib/i18n";
import { EXPENSE_ICON } from "@/lib/taxonomy-icons";
import { todayInTokyo } from "@/lib/tokyo-date";
import { saveRecord } from "@/lib/trip-actions";
import { useTrip } from "@/lib/trip-store";
import { useUsdRate } from "@/lib/usd-rate";

const NOBODY = "nobody";

// What the form starts with when logging a place, booking or hotel.
export type ExpensePrefill = Partial<
  Pick<
    ExpenseRecord,
    | "title"
    | "category"
    | "date"
    | "amountJPY"
    | "originalUSD"
    | "rateJPYPerUSD"
    | "placeId"
    | "reservationId"
    | "stayId"
    | "cityId"
  >
>;

// Logging a place: its name and matching category, and its estimate if known.
export function placePrefill(place: Place): ExpensePrefill {
  return {
    title: place.name,
    category: categoryForPlace(place.category),
    placeId: place.id,
    ...(place.costEstimateJPY !== null && {
      amountJPY: place.costEstimateJPY,
    }),
  };
}

export function personLabel(email: string | null): string {
  return email ? email.split("@")[0] : t("budget.nobody");
}

export function ExpenseCategoryOption({
  category,
}: {
  category: ExpenseCategory;
}) {
  const Icon = EXPENSE_ICON[category];
  return (
    <>
      <Icon style={{ color: EXPENSE_COLOR[category] }} />
      {t(`expenseCategory.${category}`)}
    </>
  );
}

// Adds or edits one expense. Whole yen only.
export function ExpenseForm({
  tripId,
  expense,
  prefill = {},
  onClose,
}: {
  tripId: string;
  expense: ExpenseRecord | null;
  prefill?: ExpensePrefill;
  onClose: () => void;
}) {
  const members = useActiveTrip()?.members ?? [];
  const stays = useTrip().stays;
  const me = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);
  const startDate = expense?.date ?? prefill.date ?? todayInTokyo();
  const [title, setTitle] = useState(expense?.title ?? prefill.title ?? "");
  const { rate } = useUsdRate.getState();
  const [amount, setAmount] = useState<AmountEntry>(() =>
    entryFor(
      expense ?? (prefill.amountJPY != null ? prefill : null),
      Math.round(rate * 100) / 100,
    ),
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? prefill.category ?? "other",
  );
  const [date, setDate] = useState(startDate);
  const [status, setStatus] = useState<ExpenseStatus>(
    expense?.status ?? (startDate > todayInTokyo() ? "planned" : "paid"),
  );
  const [paidBy, setPaidBy] = useState(
    expense ? (expense.paidBy ?? NOBODY) : (me ?? NOBODY),
  );
  const [note, setNote] = useState(expense?.note ?? "");

  const money = readAmount(amount);
  const valid =
    title.trim() !== "" && money !== null && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const people = [...new Set([...members, ...(me ? [me] : [])])];

  function save() {
    if (!money) return;
    const record: ExpenseRecord = {
      id: expense?.id ?? crypto.randomUUID(),
      title: title.trim(),
      ...money,
      category,
      date,
      status,
      paidBy: paidBy === NOBODY ? null : paidBy,
      placeId: expense?.placeId ?? prefill.placeId ?? null,
      reservationId: expense?.reservationId ?? prefill.reservationId ?? null,
      stayId: expense?.stayId ?? prefill.stayId ?? null,
      // A new cost is put in the city of that night, as a quick entry is.
      cityId: expense
        ? expense.cityId
        : (prefill.cityId ?? nightStay(date, stays)?.cityId ?? null),
      note: note.trim() || null,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
    saveRecord(
      tripId,
      "expenses",
      record,
      t("activity.savedExpense", { title: record.title }),
    ).catch(() => toast.error(t("common.refused")));
    onClose();
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={expense ? t("budget.editExpense") : t("budget.addExpense")}
      canSubmit={valid}
      onSubmit={save}
    >
      <Field label={t("budget.what")} htmlFor="expense-title">
        <Input
          id="expense-title"
          value={title}
          maxLength={200}
          required
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label={t("budget.amount")} htmlFor="expense-amount">
        <AmountInput
          id="expense-amount"
          value={amount}
          required
          onChange={setAmount}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.date")} htmlFor="expense-date">
          <Input
            id="expense-date"
            type="date"
            value={date}
            required
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={t("budget.status")} htmlFor="expense-status">
          <StatusToggle
            id="expense-status"
            value={status}
            onChange={setStatus}
          />
        </Field>
      </div>
      <Field label={t("common.category")} htmlFor="expense-category">
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as ExpenseCategory)}
        >
          <SelectTrigger id="expense-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                <ExpenseCategoryOption category={c} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("budget.paidBy")} htmlFor="expense-paid-by">
        <Select value={paidBy} onValueChange={setPaidBy}>
          <SelectTrigger id="expense-paid-by" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {people.map((email) => (
              <SelectItem key={email} value={email}>
                {personLabel(email)}
              </SelectItem>
            ))}
            <SelectItem value={NOBODY}>{t("budget.nobody")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("common.noteOptional")} htmlFor="expense-note">
        <Input
          id="expense-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </EditPanel>
  );
}

// Paid or only planned; the expense form and a booking's cost both use it.
export function StatusToggle({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ExpenseStatus;
  onChange: (value: ExpenseStatus) => void;
}) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onChange(v as ExpenseStatus)}
      className="w-full"
    >
      <ToggleGroupItem value="paid" className="flex-1">
        {t("budget.paid")}
      </ToggleGroupItem>
      <ToggleGroupItem value="planned" className="flex-1">
        {t("budget.planned")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

// An icon button that logs the cost of a stop, booking or hotel.
export function LogCostButton({
  tripId,
  prefill,
  className,
  label = t("budget.logCost"),
}: {
  tripId: string;
  prefill: ExpensePrefill;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        title={label}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Wallet />
      </Button>
      {open && (
        <ExpenseForm
          tripId={tripId}
          expense={null}
          prefill={prefill}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
