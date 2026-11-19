"use client";

import { useState } from "react";
import { JapaneseYen, Plus } from "lucide-react";

import { ExpenseForm } from "@/components/expense-form";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { todayInTokyo } from "@/lib/tokyo-date";
import { cn } from "@/lib/utils";
import { useTripId } from "@/lib/use-trip-id";
import { useReadOnly } from "@/lib/viewer-store";

// A large "+ ¥" button that logs a cost in a few taps: the amount, a
// category, Save. The date is `date` (today in Tokyo by default) and the
// city is where that night is spent. It opens the same expense form as the
// budget.
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
        <ExpenseForm
          tripId={tripId}
          expense={null}
          prefill={{ date: date ?? todayInTokyo() }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
