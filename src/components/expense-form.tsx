"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

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
} from "@/domain/schemas";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { useActiveTrip, useAuthStore } from "@/lib/auth-store";
import { t } from "@/lib/i18n";
import { EXPENSE_ICON } from "@/lib/taxonomy-icons";
import { todayInTokyo } from "@/lib/tokyo-date";
import { saveRecord } from "@/lib/trip-actions";

const NOBODY = "nobody";

// What the form starts with when logging a place, booking or hotel.
export type ExpensePrefill = Partial<
  Pick<
    ExpenseRecord,
    | "title"
    | "category"
    | "date"
    | "amountJPY"
    | "placeId"
    | "reservationId"
    | "stayId"
  >
>;

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
  const me = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);
  const startDate = expense?.date ?? prefill.date ?? todayInTokyo();
  const [title, setTitle] = useState(expense?.title ?? prefill.title ?? "");
  const [amount, setAmount] = useState(
    String(expense?.amountJPY ?? prefill.amountJPY ?? ""),
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

  const yen = Number(amount.replace(/[,\s¥]/g, ""));
  const valid =
    title.trim() !== "" &&
    amount.trim() !== "" &&
    Number.isInteger(yen) &&
    yen >= 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(date);
  const people = [...new Set([...members, ...(me ? [me] : [])])];

  function save() {
    const record: ExpenseRecord = {
      id: expense?.id ?? crypto.randomUUID(),
      title: title.trim(),
      amountJPY: yen,
      category,
      date,
      status,
      paidBy: paidBy === NOBODY ? null : paidBy,
      placeId: expense?.placeId ?? prefill.placeId ?? null,
      reservationId: expense?.reservationId ?? prefill.reservationId ?? null,
      stayId: expense?.stayId ?? prefill.stayId ?? null,
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
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("budget.amount")} htmlFor="expense-amount">
          <Input
            id="expense-amount"
            inputMode="numeric"
            value={amount}
            required
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={t("common.date")} htmlFor="expense-date">
          <Input
            id="expense-date"
            type="date"
            value={date}
            required
            onChange={(e) => setDate(e.target.value)}
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
      <Field label={t("budget.status")} htmlFor="expense-status">
        <ToggleGroup
          id="expense-status"
          type="single"
          variant="outline"
          size="sm"
          value={status}
          onValueChange={(v) => v && setStatus(v as ExpenseStatus)}
          className="justify-start"
        >
          <ToggleGroupItem value="paid">{t("budget.paid")}</ToggleGroupItem>
          <ToggleGroupItem value="planned">
            {t("budget.planned")}
          </ToggleGroupItem>
        </ToggleGroup>
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

// An icon button that logs the cost of a booking or hotel.
export function LogCostButton({
  tripId,
  prefill,
}: {
  tripId: string;
  prefill: ExpensePrefill;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("budget.logCost")}
        title={t("budget.logCost")}
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
