"use client";

import { useState } from "react";
import { JapaneseYen, Plus } from "lucide-react";
import { toast } from "sonner";

import { AmountInput } from "@/components/amount-input";
import { EditPanel, Field } from "@/components/edit-panel";
import {
  ExpenseForm,
  PaymentToggle,
  type ExpensePrefill,
} from "@/components/expense-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { entryFor, readAmount, type AmountEntry } from "@/domain/amount";
import { QUICK_CATEGORIES, quickExpense } from "@/domain/quick-expense";
import type { ExpenseCategory, PaymentMethod } from "@/domain/schemas";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { nightStay } from "@/domain/trip";
import { useAuthStore } from "@/lib/auth-store";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { EXPENSE_ICON } from "@/lib/taxonomy-icons";
import { todayInTokyo } from "@/lib/tokyo-date";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useCitiesById, useTrip } from "@/lib/trip-store";
import { useUsdRate } from "@/lib/usd-rate";
import { lastPaymentMethod, rememberPaymentMethod } from "@/lib/payment-method";
import { cn } from "@/lib/utils";
import { useTripId } from "@/lib/use-trip-id";
import { useReadOnly } from "@/lib/viewer-store";

const LAST_KEY = "quick-expense-category";

function lastCategory(): ExpenseCategory {
  try {
    const saved = localStorage.getItem(LAST_KEY);
    return QUICK_CATEGORIES.find((c) => c === saved) ?? "food";
  } catch {
    return "food";
  }
}

// A large "+ ¥" button that logs a cost in a few taps: the amount, a
// category, Save. The date is `date` (today in Tokyo by default) and the
// city is where that night is spent.
export function QuickExpenseButton({
  date,
  className,
}: {
  date?: string;
  className?: string;
}) {
  const tripId = useTripId();
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<ExpensePrefill | null>(null);
  if (!tripId || readOnly) return null;

  return (
    <>
      <Button
        size="lg"
        className={cn("gap-1 text-base font-semibold", className)}
        aria-label={t("quickExpense.open")}
        onClick={() => setOpen(true)}
      >
        <Plus />
        <JapaneseYen />
      </Button>
      {open && (
        <QuickExpenseForm
          tripId={tripId}
          date={date ?? todayInTokyo()}
          onClose={() => setOpen(false)}
          onMore={(prefill) => {
            setOpen(false);
            setDetails(prefill);
          }}
        />
      )}
      {details && (
        <ExpenseForm
          tripId={tripId}
          expense={null}
          prefill={details}
          onClose={() => setDetails(null)}
        />
      )}
    </>
  );
}

function QuickExpenseForm({
  tripId,
  date,
  onClose,
  onMore,
}: {
  tripId: string;
  date: string;
  onClose: () => void;
  onMore: (prefill: ExpensePrefill) => void;
}) {
  const trip = useTrip();
  const citiesById = useCitiesById();
  const me = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);
  const [amount, setAmount] = useState<AmountEntry>(() =>
    entryFor(null, Math.round(useUsdRate.getState().rate * 100) / 100),
  );
  const [category, setCategory] = useState<ExpenseCategory>(lastCategory);
  const [method, setMethod] = useState<PaymentMethod>(lastPaymentMethod);
  const [title, setTitle] = useState("");
  const money = readAmount(amount);
  const yen = money?.amountJPY ?? null;
  const city = citiesById.get(nightStay(date, trip.stays)?.cityId ?? "");

  function save() {
    if (money === null) return;
    const record = quickExpense({
      id: crypto.randomUUID(),
      ...money,
      category,
      date,
      today: todayInTokyo(),
      stays: trip.stays,
      paidBy: me,
      paymentMethod: method,
      title,
      tr: t,
      now: new Date(),
    });
    try {
      localStorage.setItem(LAST_KEY, category);
    } catch {
      // Only a convenience for next time.
    }
    rememberPaymentMethod(method);
    saveRecord(
      tripId,
      "expenses",
      record,
      t("activity.savedExpense", { title: record.title }),
    ).catch(() => toast.error(t("common.refused")));
    onClose();
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

  return (
    <EditPanel
      open
      onOpenChange={(next) => !next && onClose()}
      title={t("quickExpense.title")}
      description={
        city
          ? t("quickExpense.whenWhere", {
              day: formatDayLabel(date),
              city: city.name,
            })
          : formatDayLabel(date)
      }
      canSubmit={yen !== null}
      onSubmit={save}
    >
      <Field label={t("budget.amount")} htmlFor="quick-amount">
        <AmountInput
          id="quick-amount"
          autoFocus
          large
          value={amount}
          onChange={setAmount}
        />
      </Field>
      <Field label={t("common.category")} htmlFor="quick-category">
        <ToggleGroup
          id="quick-category"
          type="single"
          variant="outline"
          value={category}
          onValueChange={(v) => v && setCategory(v as ExpenseCategory)}
          className="grid w-full grid-cols-4 gap-1.5"
        >
          {QUICK_CATEGORIES.map((c) => {
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
      <Field label={t("budget.paidWith")} htmlFor="quick-method">
        <PaymentToggle id="quick-method" value={method} onChange={setMethod} />
      </Field>
      <Field label={t("quickExpense.what")} htmlFor="quick-title">
        <Input
          id="quick-title"
          value={title}
          maxLength={200}
          placeholder={t(`expenseCategory.${category}`)}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Button
        type="button"
        variant="link"
        className="h-auto self-start p-0"
        onClick={() =>
          onMore({
            title: title.trim() || t(`expenseCategory.${category}`),
            category,
            date,
            paymentMethod: method,
            ...(money !== null && money),
          })
        }
      >
        {t("quickExpense.more")}
      </Button>
    </EditPanel>
  );
}
