import type { AmountResult } from "./amount";
import { categoryForReservation } from "./budget";
import type { Translate } from "./i18n";
import type {
  ExpenseRecord,
  ExpenseStatus,
  PaymentMethod,
  Reservation,
  ReservationRecord,
} from "./schemas";
import { isRideReservation } from "./schemas";

type Labelled = Pick<Reservation, "type" | "from" | "to"> &
  Partial<Pick<Reservation, "venue">>;

// "Train · Tokyo · Kyoto" or "Park or garden · Shinjuku Gyoen": how a booking
// is named in its expense and lists. A ride names its stations; an entry its
// venue (a chosen place's name is saved as the venue too).
export function bookingLabel(reservation: Labelled, tr: Translate): string {
  return [
    tr(`reservationType.${reservation.type}`),
    ...bookingWhere(reservation),
  ]
    .filter(Boolean)
    .join(" · ");
}

// Where a booking is: the stations of a ride, or the venue of an entry.
// Older entries kept their place in "from" or "to".
function bookingWhere(r: Labelled): (string | null)[] {
  if (isRideReservation(r.type)) return [r.from, r.to];
  return r.venue ? [r.venue] : [r.from, r.to];
}

// One line for a booking's place: "Tokyo → Kyoto" for a ride, the venue for
// an entry.
export function bookingPlace(r: Labelled): string {
  const [a, b] = bookingWhere(r);
  if (a && b) return isRideReservation(r.type) ? `${a} → ${b}` : `${a} · ${b}`;
  return a ?? b ?? "";
}

// The booking's times and details: "08:10–10:24 · Nozomi 21 · Car 7, 12A"
// for a ride, "10:00–12:00 · 2 people" for an entry.
export function bookingDetails(
  r: Pick<
    Reservation,
    "type" | "time" | "endTime" | "trainName" | "seat" | "people"
  >,
  tr: Translate,
): string {
  const times =
    r.time && r.endTime ? `${r.time}–${r.endTime}` : (r.time ?? r.endTime);
  const extra = isRideReservation(r.type)
    ? [r.trainName, r.seat]
    : [r.people ? tr("bookings.peopleCount", { count: r.people }) : null];
  return [times, ...extra].filter(Boolean).join(" · ");
}

// The cost saved with a booking: the first live expense that points at it.
// Costs logged later with the wallet button are extra and stay apart.
export function linkedExpense(
  expenses: ExpenseRecord[],
  reservationId: string,
): ExpenseRecord | null {
  return (
    expenses.find((e) => !e.archived && e.reservationId === reservationId) ??
    null
  );
}

// Every live cost of a booking, the one saved with it and any logged later:
// archiving the booking takes them all out of the budget.
export function bookingCosts(
  expenses: ExpenseRecord[],
  reservationId: string,
): ExpenseRecord[] {
  return expenses.filter(
    (e) => !e.archived && e.reservationId === reservationId,
  );
}

// The expense a booking's cost is saved as. An existing one keeps who paid,
// its note and its city; its title, category and date follow the booking.
export function bookingExpense(input: {
  reservation: ReservationRecord;
  existing: ExpenseRecord | null;
  amount: AmountResult;
  status: ExpenseStatus;
  paymentMethod?: PaymentMethod;
  paidBy: string | null;
  cityId: string | null;
  id: string;
  tr: Translate;
  now: Date;
}): ExpenseRecord {
  const { reservation, existing } = input;
  return {
    id: existing?.id ?? input.id,
    title: bookingLabel(reservation, input.tr).slice(0, 200),
    ...input.amount,
    category: existing?.category ?? categoryForReservation(reservation.type),
    date: reservation.date,
    status: input.status,
    paidBy: existing ? existing.paidBy : input.paidBy,
    placeId: existing?.placeId ?? null,
    reservationId: reservation.id,
    stayId: existing?.stayId ?? null,
    cityId: existing ? existing.cityId : input.cityId,
    paymentMethod: input.paymentMethod ?? existing?.paymentMethod ?? "card",
    note: existing?.note ?? null,
    archived: false,
    updatedAt: input.now.toISOString(),
  };
}
