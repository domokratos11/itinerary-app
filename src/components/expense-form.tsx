"use client";

import { useState } from "react";
import { Banknote, CreditCard, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AmountInput } from "@/components/amount-input";
import { EditPanel, Field } from "@/components/edit-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseRecord,
  type ExpenseStatus,
  type PaymentMethod,
  type Place,
} from "@/domain/schemas";
import { entryFor, readAmount, type AmountEntry } from "@/domain/amount";
import { categoryForPlace, payerOf } from "@/domain/budget";
import { QUICK_CATEGORIES } from "@/domain/quick-expense";
import { nightStay } from "@/domain/trip";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { useActiveTrip, useAuthStore } from "@/lib/auth-store";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { EXPENSE_ICON } from "@/lib/taxonomy-icons";
import { todayInTokyo } from "@/lib/tokyo-date";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useCitiesById, useTrip } from "@/lib/trip-store";
import { useUsdRate } from "@/lib/usd-rate";
import { lastPaymentMethod, rememberPaymentMethod } from "@/lib/payment-method";
import { cn } from "@/lib/utils";

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
    | "paymentMethod"
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

// The categories as big tiles, the ones used on the go first. Flights and
// bookings come last: they're mostly logged from their own screens.
const CATEGORY_TILES: ExpenseCategory[] = [
  ...QUICK_CATEGORIES,
  ...EXPENSE_CATEGORIES.filter((c) => !QUICK_CATEGORIES.includes(c)),
];

// The category of the last cost logged, so the next one starts there.
const LAST_KEY = "quick-expense-category";
function lastCategory(): ExpenseCategory {
  try {
    const saved = localStorage.getItem(LAST_KEY);
    return EXPENSE_CATEGORIES.find((c) => c === saved) ?? "food";
  } catch {
    return "food";
  }
}
function rememberCategory(category: ExpenseCategory) {
  try {
    localStorage.setItem(LAST_KEY, category);
  } catch {
    // Only a convenience for next time.
  }
}

// Adds or edits one expense; the one form for every way of logging a cost
// (the day's "+ ¥", the budget, a place, a booking or a hotel). Large
// controls for a phone: the amount, a category tile, who paid and how, then
// what it was for, the date and whether it's paid. A new cost is paid by the
// person signed in, on today's date in Tokyo unless it's logged for a day.
// Whole yen only.
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
  const trip = useTrip();
  const citiesById = useCitiesById();
  const me = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);
  const today = todayInTokyo();
  const [title, setTitle] = useState(expense?.title ?? prefill.title ?? "");
  const { rate } = useUsdRate.getState();
  const [amount, setAmount] = useState<AmountEntry>(() =>
    entryFor(
      expense ?? (prefill.amountJPY != null ? prefill : null),
      Math.round(rate * 100) / 100,
    ),
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    () => expense?.category ?? prefill.category ?? lastCategory(),
  );
  const [date, setDate] = useState(expense?.date ?? prefill.date ?? today);
  // Follows the date (a future day is planned) until it's picked by hand.
  const [pickedStatus, setPickedStatus] = useState<ExpenseStatus | null>(
    expense?.status ?? null,
  );
  const status = pickedStatus ?? (date > today ? "planned" : "paid");
  // Always a real person: an old expense with no payer opens on the trip's
  // first member, the one it's counted under.
  const [paidBy, setPaidBy] = useState<string | null>(
    expense ? payerOf(expense, members) : (me ?? members[0] ?? null),
  );
  const [method, setMethod] = useState<PaymentMethod>(
    () =>
      expense?.paymentMethod ?? prefill.paymentMethod ?? lastPaymentMethod(),
  );
  const [note, setNote] = useState(expense?.note ?? "");

  const money = readAmount(amount);
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const valid = money !== null && paidBy !== null && isDate;
  const people = [
    ...new Set([...members, ...(me ? [me] : []), ...(paidBy ? [paidBy] : [])]),
  ];
  const city = isDate
    ? citiesById.get(nightStay(date, trip.stays)?.cityId ?? "")
    : undefined;

  function save() {
    if (!money) return;
    const record: ExpenseRecord = {
      id: expense?.id ?? crypto.randomUUID(),
      title: (title.trim() || t(`expenseCategory.${category}`)).slice(0, 200),
      ...money,
      category,
      date,
      status,
      paidBy,
      paymentMethod: method,
      placeId: expense?.placeId ?? prefill.placeId ?? null,
      reservationId: expense?.reservationId ?? prefill.reservationId ?? null,
      stayId: expense?.stayId ?? prefill.stayId ?? null,
      // A new cost is put in the city of that night.
      cityId: expense
        ? expense.cityId
        : (prefill.cityId ?? nightStay(date, trip.stays)?.cityId ?? null),
      note: note.trim() || null,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
    if (!expense) {
      rememberPaymentMethod(method);
      rememberCategory(category);
    }
    saveRecord(
      tripId,
      "expenses",
      record,
      t("activity.savedExpense", { title: record.title }),
    ).catch(() => toast.error(t("common.refused")));
    onClose();
    if (!expense)
      toast(
        t("quickExpense.saved", {
          amount: money.amountJPY.toLocaleString("en-US"),
        }),
        {
          action: {
            label: t("common.undo"),
            onClick: () =>
              archiveRecord(
                tripId,
                "expenses",
                record,
                t("activity.archivedExpense", { title: record.title }),
              ).catch(() => toast.error(t("common.undoFailed"))),
          },
        },
      );
  }

  const day = isDate ? formatDayLabel(date) : "";
  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={expense ? t("budget.editExpense") : t("quickExpense.title")}
      description={
        city ? t("quickExpense.whenWhere", { day, city: city.name }) : day
      }
      canSubmit={valid}
      onSubmit={save}
    >
      <Field label={t("budget.amount")} htmlFor="expense-amount">
        <AmountInput
          id="expense-amount"
          autoFocus={!expense}
          large
          required
          value={amount}
          onChange={setAmount}
        />
      </Field>
      <Field label={t("common.category")} htmlFor="expense-category">
        <ToggleGroup
          id="expense-category"
          type="single"
          variant="outline"
          value={category}
          onValueChange={(v) => v && setCategory(v as ExpenseCategory)}
          className="grid w-full grid-cols-3 gap-1.5"
        >
          {CATEGORY_TILES.map((c) => {
            const Icon = EXPENSE_ICON[c];
            return (
              <ToggleGroupItem
                key={c}
                value={c}
                className="flex h-16 flex-col gap-1 rounded-md! border text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/10"
              >
                <Icon className="size-5!" style={{ color: EXPENSE_COLOR[c] }} />
                {t(`expenseCategory.${c}`)}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </Field>
      {people.length > 0 && (
        <Field label={t("budget.paidBy")} htmlFor="expense-paid-by">
          <ToggleGroup
            id="expense-paid-by"
            type="single"
            variant="outline"
            value={paidBy ?? ""}
            onValueChange={(v) => v && setPaidBy(v)}
            className="grid w-full grid-cols-2 gap-1.5"
          >
            {people.map((email) => (
              <ToggleGroupItem
                key={email}
                value={email}
                className="h-12 min-w-0 rounded-md! border data-[state=on]:border-primary data-[state=on]:bg-primary/10"
              >
                <span className="truncate">{personLabel(email)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      )}
      <Field label={t("budget.paidWith")} htmlFor="expense-method">
        <PaymentToggle
          id="expense-method"
          large
          value={method}
          onChange={setMethod}
        />
      </Field>
      <Field label={t("quickExpense.what")} htmlFor="expense-title">
        <Input
          id="expense-title"
          value={title}
          maxLength={200}
          placeholder={t(`expenseCategory.${category}`)}
          className="h-12"
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.date")} htmlFor="expense-date">
          <Input
            id="expense-date"
            type="date"
            value={date}
            required
            className="h-12"
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={t("budget.status")} htmlFor="expense-status">
          <StatusToggle
            id="expense-status"
            large
            value={status}
            onChange={setPickedStatus}
          />
        </Field>
      </div>
      <Field label={t("common.noteOptional")} htmlFor="expense-note">
        <Input
          id="expense-note"
          value={note}
          maxLength={500}
          className="h-12"
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
  large = false,
}: {
  id: string;
  value: ExpenseStatus;
  onChange: (value: ExpenseStatus) => void;
  large?: boolean;
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
      <ToggleGroupItem value="paid" className={cn("flex-1", large && "h-12")}>
        {t("budget.paid")}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="planned"
        className={cn("flex-1", large && "h-12")}
      >
        {t("budget.planned")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export const PAYMENT_ICON = { card: CreditCard, cash: Banknote } as const;

// Card or cash; every way of logging an expense asks it.
export function PaymentToggle({
  id,
  value,
  onChange,
  large = false,
}: {
  id: string;
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  large?: boolean;
}) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onChange(v as PaymentMethod)}
      className="w-full"
    >
      {(["card", "cash"] as const).map((m) => {
        const Icon = PAYMENT_ICON[m];
        return (
          <ToggleGroupItem
            key={m}
            value={m}
            className={cn("flex-1", large && "h-12")}
          >
            <Icon />
            {t(`paymentMethod.${m}`)}
          </ToggleGroupItem>
        );
      })}
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
