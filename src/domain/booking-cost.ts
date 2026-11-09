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

// "Train · Tokyo · Kyoto": how a booking is named in its expense and lists.
export function bookingLabel(
  reservation: Pick<Reservation, "type" | "from" | "to">,
  tr: Translate,
): string {
  return [
    tr(`reservationType.${reservation.type}`),
    reservation.from,
    reservation.to,
  ]
    .filter(Boolean)
    .join(" · ");
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
