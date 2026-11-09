import { bookingLabel } from "./booking-cost";
import type { Translate } from "./i18n";
import type {
  CityRecord,
  ExpenseRecord,
  PlaceRecord,
  ReservationRecord,
} from "./schemas";
import { capitalizeFirst } from "./text";

// A cell a spreadsheet won't read as a formula: text starting with = + - @
// (or a tab or carriage return) gets a leading apostrophe.
function cell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// The trip's expenses as CSV for a spreadsheet or card reconciliation: one
// row each by date, archived ones left out. UTF-8 with a byte-order mark so
// Excel shows ¥ and Japanese names; CRLF line ends.
export function expensesCsv(
  expenses: ExpenseRecord[],
  lookups: {
    cities: Map<string, CityRecord>;
    places: Map<string, PlaceRecord>;
    reservations: Map<string, ReservationRecord>;
    person: (email: string | null) => string;
  },
  tr: Translate,
): string {
  const header = [
    tr("csv.date"),
    tr("csv.title"),
    tr("csv.category"),
    tr("csv.amountJPY"),
    tr("csv.amountUSD"),
    tr("csv.rate"),
    tr("csv.status"),
    tr("csv.paidBy"),
    tr("csv.paymentMethod"),
    tr("csv.city"),
    tr("csv.place"),
    tr("csv.booking"),
    tr("csv.note"),
  ];
  const rows = expenses
    .filter((e) => !e.archived)
    .sort((a, b) =>
      a.date === b.date
        ? a.title.localeCompare(b.title)
        : a.date < b.date
          ? -1
          : 1,
    )
    .map((e) => {
      const booking = e.reservationId
        ? lookups.reservations.get(e.reservationId)
        : undefined;
      return [
        e.date,
        capitalizeFirst(e.title),
        tr(`expenseCategory.${e.category}`),
        e.amountJPY,
        e.originalUSD,
        e.rateJPYPerUSD,
        tr(e.status === "paid" ? "budget.paid" : "budget.planned"),
        lookups.person(e.paidBy),
        tr(`paymentMethod.${e.paymentMethod}`),
        e.cityId ? (lookups.cities.get(e.cityId)?.name ?? e.cityId) : null,
        e.placeId ? (lookups.places.get(e.placeId)?.name ?? null) : null,
        booking ? bookingLabel(booking, tr) : null,
        e.note,
      ];
    });
  return (
    "﻿" +
    [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}
