"use client";

import { useMemo, useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { AmountInput } from "@/components/amount-input";
import { EditPanel, Field } from "@/components/edit-panel";
import {
  LogCostButton,
  PaymentToggle,
  StatusToggle,
} from "@/components/expense-form";
import { Yen } from "@/components/yen";
import {
  entryFor,
  readAmount,
  type AmountEntry,
  type AmountResult,
} from "@/domain/amount";
import {
  bookingCosts,
  bookingDetails,
  bookingExpense,
  bookingLabel,
  bookingPlace,
  linkedExpense,
} from "@/domain/booking-cost";
import { categoryForReservation } from "@/domain/budget";
import type {
  ExpenseRecord,
  ExpenseStatus,
  PaymentMethod,
} from "@/domain/schemas";
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
import {
  isRideReservation,
  NEW_RESERVATION_TYPES,
  RESERVATION_TYPES,
  type ReservationRecord,
} from "@/domain/schemas";
import { uniqueId } from "@/domain/trip-edit";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip, useTripStore } from "@/lib/trip-store";
import { lastPaymentMethod, rememberPaymentMethod } from "@/lib/payment-method";

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
        paymentMethod: cost.method,
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

  // A booking's costs go out of the budget with it, and Undo brings both back.
  function archive(r: ReservationRecord) {
    const costs = bookingCosts(trip.expenses, r.id);
    archiveRecord(
      tripId,
      "reservations",
      r,
      t("activity.archivedBooking", {
        type: t(`reservationType.${r.type}`).toLocaleLowerCase(),
        day: formatDayLabel(r.date),
      }),
    ).catch(() => toast.error(t("common.refused")));
    for (const cost of costs)
      archiveRecord(
        tripId,
        "expenses",
        cost,
        t("activity.archivedExpense", { title: cost.title }),
      ).catch(() => toast.error(t("common.refused")));
    toast(
      costs.length > 0
        ? t("bookings.archivedWithCost")
        : t("bookings.archived"),
      {
        action: {
          label: t("common.undo"),
          onClick: () => {
            saveRecord(
              tripId,
              "reservations",
              r,
              t("activity.restoredBooking", {
                type: t(`reservationType.${r.type}`).toLocaleLowerCase(),
                day: formatDayLabel(r.date),
              }),
            ).catch(() => toast.error(t("common.refused")));
            for (const cost of costs)
              saveRecord(
                tripId,
                "expenses",
                cost,
                t("activity.savedExpense", { title: cost.title }),
              ).catch(() => toast.error(t("common.refused")));
          },
        },
      },
    );
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
                <span className="font-medium">{formatDayLabel(r.date)}</span>
              </span>
              <span className="mt-1 block">{bookingPlace(r)}</span>
              {bookingDetails(r, t) && (
                <span className="block text-muted-foreground">
                  {bookingDetails(r, t)}
                </span>
              )}
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

type BookingCost = {
  amount: AmountResult | null;
  status: ExpenseStatus;
  method: PaymentMethod;
};

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
  const trip = useTrip();
  const [type, setType] = useState<ReservationType>(
    reservation?.type ?? "train",
  );
  const [date, setDate] = useState(reservation?.date ?? "");
  const [time, setTime] = useState(reservation?.time ?? "");
  const [endTime, setEndTime] = useState(reservation?.endTime ?? "");
  const [from, setFrom] = useState(reservation?.from ?? "");
  const [to, setTo] = useState(reservation?.to ?? "");
  const [trainName, setTrainName] = useState(reservation?.trainName ?? "");
  const [seat, setSeat] = useState(reservation?.seat ?? "");
  const [placeId, setPlaceId] = useState<string>(
    reservation?.placeId ?? OTHER_VENUE,
  );
  const [venue, setVenue] = useState(
    reservation?.placeId
      ? ""
      : (reservation?.venue ?? reservation?.to ?? reservation?.from ?? ""),
  );
  const [people, setPeople] = useState(
    reservation?.people ? String(reservation.people) : "",
  );
  const [note, setNote] = useState(reservation?.note ?? "");
  const [amount, setAmount] = useState<AmountEntry>(() =>
    entryFor(cost, Math.round(useUsdRate.getState().rate * 100) / 100),
  );
  const [status, setStatus] = useState<ExpenseStatus>(
    cost?.status ?? (date && date <= todayInTokyo() ? "paid" : "planned"),
  );
  const [method, setMethod] = useState<PaymentMethod>(
    () => cost?.paymentMethod ?? lastPaymentMethod(),
  );
  const ride = isRideReservation(type);
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

  // An entry picks from the places of the city where that night is spent,
  // keeping the one already chosen even if the date moved.
  const places = useMemo(() => {
    const cityId = isDate ? nightStay(date, trip.stays)?.cityId : undefined;
    return trip.places
      .filter(
        (p) =>
          !p.archived &&
          ((cityId !== undefined && p.cityId === cityId) ||
            p.id === reservation?.placeId),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [date, isDate, trip.stays, trip.places, reservation?.placeId]);
  const place =
    placeId === OTHER_VENUE ? null : places.find((p) => p.id === placeId);

  const noCost = amount.amount.trim() === "";
  const money = noCost ? null : readAmount(amount);
  const peopleCount = people.trim() === "" ? null : Number(people);
  const valid =
    isDate &&
    [time, endTime].every((v) => v === "" || /^\d{2}:\d{2}$/.test(v)) &&
    (peopleCount === null ||
      (Number.isInteger(peopleCount) &&
        peopleCount >= 1 &&
        peopleCount <= 20)) &&
    (noCost || money !== null);

  // Only the fields of the chosen kind are kept.
  function build(): ReservationRecord {
    const text = (v: string) => v.trim() || null;
    return {
      id: reservation?.id ?? uniqueId(`${type}-${date}`, takenIds),
      type,
      date,
      time: time || null,
      endTime: endTime || null,
      from: ride ? text(from) : null,
      to: ride ? text(to) : null,
      trainName: ride ? text(trainName) : null,
      seat: ride ? text(seat) : null,
      placeId: !ride && place ? place.id : null,
      venue: ride ? null : place ? place.name.slice(0, 100) : text(venue),
      people: ride ? null : peopleCount,
      note: text(note),
      archived: false,
      updatedAt: new Date().toISOString(),
    };
  }

  // Older bookings of a kind no longer offered can still be edited as such.
  const types = (RESERVATION_TYPES as readonly ReservationType[]).filter(
    (option) =>
      (NEW_RESERVATION_TYPES as readonly ReservationType[]).includes(option) ||
      option === reservation?.type,
  );

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={reservation ? t("bookings.edit") : t("bookings.add")}
      canSubmit={valid}
      onSubmit={() => {
        if (!cost && money) rememberPaymentMethod(method);
        onSave(build(), { amount: money, status, method });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.type")} htmlFor="res-type">
          <Select
            value={type}
            onValueChange={(v) => setType(v as ReservationType)}
          >
            <SelectTrigger id="res-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`reservationType.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("common.date")} htmlFor="res-date">
          <Input
            id="res-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
      </div>
      {ride ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("bookings.from")} htmlFor="res-from">
              <Input
                id="res-from"
                value={from}
                maxLength={100}
                placeholder={t("bookings.fromPlaceholder")}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label={t("bookings.to")} htmlFor="res-to">
              <Input
                id="res-to"
                value={to}
                maxLength={100}
                placeholder={t("bookings.toPlaceholder")}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("bookings.departure")} htmlFor="res-time">
              <Input
                id="res-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
            <Field label={t("bookings.arrival")} htmlFor="res-end">
              <Input
                id="res-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("bookings.trainName")} htmlFor="res-train">
              <Input
                id="res-train"
                value={trainName}
                maxLength={50}
                placeholder={t("bookings.trainNamePlaceholder")}
                onChange={(e) => setTrainName(e.target.value)}
              />
            </Field>
            <Field label={t("bookings.seat")} htmlFor="res-seat">
              <Input
                id="res-seat"
                value={seat}
                maxLength={30}
                placeholder={t("bookings.seatPlaceholder")}
                onChange={(e) => setSeat(e.target.value)}
              />
            </Field>
          </div>
        </>
      ) : (
        <>
          {places.length > 0 && (
            <Field
              label={t("bookings.place")}
              htmlFor="res-place"
              hint={t("bookings.placeHint")}
            >
              <Select value={placeId} onValueChange={setPlaceId}>
                <SelectTrigger id="res-place" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {places.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_VENUE}>
                    {t("bookings.otherVenue")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {!place && (
            <Field label={t("bookings.venue")} htmlFor="res-venue">
              <Input
                id="res-venue"
                value={venue}
                maxLength={100}
                placeholder={t("bookings.venuePlaceholder")}
                onChange={(e) => setVenue(e.target.value)}
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("bookings.entryTime")} htmlFor="res-time">
              <Input
                id="res-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
            <Field label={t("bookings.endTime")} htmlFor="res-end">
              <Input
                id="res-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("bookings.people")} htmlFor="res-people">
            <Input
              id="res-people"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              className="w-24"
            />
          </Field>
        </>
      )}
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
      {!noCost && (
        <Field label={t("budget.paidWith")} htmlFor="res-cost-method">
          <PaymentToggle
            id="res-cost-method"
            value={method}
            onChange={setMethod}
          />
        </Field>
      )}
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

// The place Select's choice for a venue typed by hand.
const OTHER_VENUE = "__other";
