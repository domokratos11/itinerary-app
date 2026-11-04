"use client";

import { useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { AmountInput } from "@/components/amount-input";
import { EditPanel, Field } from "@/components/edit-panel";
import { LogCostButton, StatusToggle } from "@/components/expense-form";
import { Yen } from "@/components/yen";
import {
  entryFor,
  readAmount,
  type AmountEntry,
  type AmountResult,
} from "@/domain/amount";
import {
  bookingExpense,
  bookingLabel,
  linkedExpense,
} from "@/domain/booking-cost";
import { categoryForReservation } from "@/domain/budget";
import type { ExpenseRecord, ExpenseStatus } from "@/domain/schemas";
import { nightStay } from "@/domain/trip";
import { useAuthStore } from "@/lib/auth-store";
import { todayInTokyo } from "@/lib/tokyo-date";
import { useUsdRate } from "@/lib/usd-rate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RESERVATION_TYPES, type ReservationRecord } from "@/domain/schemas";
import { uniqueId } from "@/domain/trip-edit";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip, useTripStore } from "@/lib/trip-store";

type Editing = { record: ReservationRecord | null } | null;
type ReservationType = ReservationRecord["type"];

export function ReservationsSettings({ tripId }: { tripId: string }) {
  const trip = useTrip();
  const all = useTripStore((s) => s.data.reservations);
  const [editing, setEditing] = useState<Editing>(null);
  const me = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);

  function save(record: ReservationRecord, cost: BookingCost) {
    saveCost(record, cost);
    saveRecord(
      tripId,
      "reservations",
      record,
      t("activity.savedBooking", {
        type: t(`reservationType.${record.type}`).toLocaleLowerCase(),
        day: formatDayLabel(record.date),
      }),
    ).catch(() => toast.error(t("common.refused")));
    setEditing(null);
  }

  // The cost lives in the budget, as an expense pointing at the booking.
  function saveCost(record: ReservationRecord, cost: BookingCost) {
    const existing = linkedExpense(trip.expenses, record.id);
    if (cost.amount) {
      const expense = bookingExpense({
        reservation: record,
        existing,
        amount: cost.amount,
        status: cost.status,
        paidBy: me,
        cityId: nightStay(record.date, trip.stays)?.cityId ?? null,
        id: crypto.randomUUID(),
        tr: t,
        now: new Date(),
      });
      saveRecord(
        tripId,
        "expenses",
        expense,
        t("activity.savedExpense", { title: expense.title }),
      ).catch(() => toast.error(t("common.refused")));
    } else if (existing) {
      archiveRecord(
        tripId,
        "expenses",
        existing,
        t("activity.archivedExpense", { title: existing.title }),
      ).catch(() => toast.error(t("common.refused")));
    }
  }

  function archive(r: ReservationRecord) {
    archiveRecord(
      tripId,
      "reservations",
      r,
      t("activity.archivedBooking", {
        type: t(`reservationType.${r.type}`).toLocaleLowerCase(),
        day: formatDayLabel(r.date),
      }),
    ).catch(() => toast.error(t("common.refused")));
    toast(t("bookings.archived"), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(
            tripId,
            "reservations",
            r,
            t("activity.restoredBooking", {
              type: t(`reservationType.${r.type}`).toLocaleLowerCase(),
              day: formatDayLabel(r.date),
            }),
          ).catch(() => toast.error(t("common.refused"))),
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {trip.reservations.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {t(`reservationType.${r.type}`)}
                </Badge>
                <span className="font-medium">
                  {formatDayLabel(r.date)}
                  {r.time && ` · ${r.time}`}
                </span>
              </span>
              <span className="mt-1 block">
                {r.from && r.to
                  ? `${r.from} → ${r.to}`
                  : (r.from ?? r.to ?? "")}
              </span>
              {r.note && (
                <span className="block text-muted-foreground">{r.note}</span>
              )}
              <BookingCostLine cost={linkedExpense(trip.expenses, r.id)} />
            </span>
            <LogCostButton
              tripId={tripId}
              label={t("bookings.extraCost")}
              prefill={{
                title: bookingLabel(r, t),
                category: categoryForReservation(r.type),
                date: r.date,
                reservationId: r.id,
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("bookings.edit")}
              onClick={() => setEditing({ record: r })}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("bookings.archiveAria")}
              onClick={() => archive(r)}
            >
              <Archive />
            </Button>
          </li>
        ))}
      </ul>
      {trip.reservations.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("bookings.none")}</p>
      )}
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setEditing({ record: null })}
      >
        <Plus />
        {t("bookings.add")}
      </Button>
      {editing && (
        <ReservationForm
          key={editing.record?.id ?? "new"}
          reservation={editing.record}
          cost={
            editing.record
              ? linkedExpense(trip.expenses, editing.record.id)
              : null
          }
          takenIds={all.map((r) => r.id)}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

type BookingCost = { amount: AmountResult | null; status: ExpenseStatus };

// The booking's cost on its card, or that it has none yet.
function BookingCostLine({ cost }: { cost: ExpenseRecord | null }) {
  if (!cost)
    return (
      <span className="mt-1 block text-xs text-muted-foreground">
        {t("bookings.noCost")}
      </span>
    );
  return (
    <span className="mt-1 flex items-center gap-2">
      <span className="font-medium tabular-nums">
        <Yen yen={cost.amountJPY} />
      </span>
      <Badge variant="outline">
        {cost.status === "paid" ? t("budget.paid") : t("budget.planned")}
      </Badge>
    </span>
  );
}

function ReservationForm({
  reservation,
  cost,
  takenIds,
  onCancel,
  onSave,
}: {
  reservation: ReservationRecord | null;
  cost: ExpenseRecord | null;
  takenIds: string[];
  onCancel: () => void;
  onSave: (record: ReservationRecord, cost: BookingCost) => void;
}) {
  const [type, setType] = useState<ReservationType>(
    reservation?.type ?? "train",
  );
  const [date, setDate] = useState(reservation?.date ?? "");
  const [time, setTime] = useState(reservation?.time ?? "");
  const [from, setFrom] = useState(reservation?.from ?? "");
  const [to, setTo] = useState(reservation?.to ?? "");
  const [note, setNote] = useState(reservation?.note ?? "");
  const [amount, setAmount] = useState<AmountEntry>(() =>
    entryFor(cost, Math.round(useUsdRate.getState().rate * 100) / 100),
  );
  const [status, setStatus] = useState<ExpenseStatus>(
    cost?.status ?? (date && date <= todayInTokyo() ? "paid" : "planned"),
  );
  const noCost = amount.amount.trim() === "";
  const money = noCost ? null : readAmount(amount);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    (time === "" || /^\d{2}:\d{2}$/.test(time)) &&
    (noCost || money !== null);

  function build(): ReservationRecord {
    return {
      id: reservation?.id ?? uniqueId(`${type}-${date}`, takenIds),
      type,
      date,
      time: time || null,
      from: from.trim() || null,
      to: to.trim() || null,
      note: note.trim() || null,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={reservation ? t("bookings.edit") : t("bookings.add")}
      canSubmit={valid}
      onSubmit={() => onSave(build(), { amount: money, status })}
    >
      <Field label={t("common.type")} htmlFor="res-type">
        <Select
          value={type}
          onValueChange={(v) => setType(v as ReservationType)}
        >
          <SelectTrigger id="res-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Flights have their own section; an older one can still be edited. */}
            {RESERVATION_TYPES.filter(
              (option) => option !== "flight" || reservation?.type === "flight",
            ).map((option) => (
              <SelectItem key={option} value={option}>
                {t(`reservationType.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.date")} htmlFor="res-date">
          <Input
            id="res-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field label={t("bookings.timeOptional")} htmlFor="res-time">
          <Input
            id="res-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("bookings.from")} htmlFor="res-from">
          <Input
            id="res-from"
            value={from}
            maxLength={100}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label={t("bookings.to")} htmlFor="res-to">
          <Input
            id="res-to"
            value={to}
            maxLength={100}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field
          label={t("bookings.cost")}
          htmlFor="res-cost"
          hint={t("bookings.costHint")}
        >
          <AmountInput id="res-cost" value={amount} onChange={setAmount} />
        </Field>
        <Field label={t("budget.status")} htmlFor="res-cost-status">
          <StatusToggle
            id="res-cost-status"
            value={status}
            onChange={setStatus}
          />
        </Field>
      </div>
      <Field
        label={t("common.noteOptional")}
        htmlFor="res-note"
        hint={t("stays.privateHint")}
      >
        <Textarea
          id="res-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </EditPanel>
  );
}
