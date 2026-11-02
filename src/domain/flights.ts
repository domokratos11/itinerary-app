import { formatYen, YEN_PER_USD } from "./budget";
import type { TripDay } from "./days";
import {
  FlightRecordSchema,
  type FlightCurrency,
  type FlightRecord,
} from "./schemas";

// A flight's dates and times are local to each airport, as printed on the
// ticket, so an arrival can read earlier than its departure across the date
// line. They're shown as they are and never converted.
export function flightsOnDay(
  flights: FlightRecord[],
  date: string,
): FlightRecord[] {
  return flights.filter((f) => f.departDate === date || f.arriveDate === date);
}

// Flights leaving on a date the stays don't cover, such as the way there and
// back, which no day's page can show.
export function flightsOutsideDays(
  flights: FlightRecord[],
  days: Pick<TripDay, "date">[],
): { before: FlightRecord[]; after: FlightRecord[] } {
  if (days.length === 0) return { before: flights, after: [] };
  const known = new Set(days.map((d) => d.date));
  const outside = flights.filter((f) => !known.has(f.departDate));
  return {
    before: outside.filter((f) => f.departDate < days[0].date),
    after: outside.filter((f) => f.departDate >= days[0].date),
  };
}

// The next flight from today on, from a list in date order.
export function nextFlight(
  flights: FlightRecord[],
  today: string,
): FlightRecord | null {
  return flights.find((f) => f.departDate >= today) ?? null;
}

export function flightRoute(flight: FlightRecord): string {
  return `${flight.departAirport} → ${flight.arriveAirport}`;
}

// What it cost, or null when nothing is known or it came with another flight.
export function flightCostLabel(flight: FlightRecord): string | null {
  if (!flight.costAmount) return null;
  return flight.costCurrency === "JPY"
    ? formatYen(flight.costAmount)
    : flight.costAmount.toLocaleString("en-US", {
        style: "currency",
        currency: flight.costCurrency,
      });
}

// A starting amount for logging it in the budget, which is kept in yen.
export function flightCostInYen(flight: FlightRecord): number | null {
  if (!flight.costAmount) return null;
  return flight.costCurrency === "JPY"
    ? Math.round(flight.costAmount)
    : Math.round(flight.costAmount * YEN_PER_USD);
}

export type FlightForm = {
  airline: string;
  flightNumber: string;
  departDate: string;
  departTime: string;
  departAirport: string;
  departCity: string;
  arriveDate: string;
  arriveTime: string;
  arriveAirport: string;
  arriveCity: string;
  confirmation: string;
  costAmount: string;
  costCurrency: FlightCurrency;
  note: string;
};

export function flightToForm(flight: FlightRecord | null): FlightForm {
  return {
    airline: flight?.airline ?? "",
    flightNumber: flight?.flightNumber ?? "",
    departDate: flight?.departDate ?? "",
    departTime: flight?.departTime ?? "",
    departAirport: flight?.departAirport ?? "",
    departCity: flight?.departCity ?? "",
    arriveDate: flight?.arriveDate ?? "",
    arriveTime: flight?.arriveTime ?? "",
    arriveAirport: flight?.arriveAirport ?? "",
    arriveCity: flight?.arriveCity ?? "",
    confirmation: flight?.confirmation ?? "",
    costAmount: flight?.costAmount?.toString() ?? "",
    costCurrency: flight?.costCurrency ?? "USD",
    note: flight?.note ?? "",
  };
}

const orNull = (text: string) => text.trim() || null;

// The record the form describes, or null while something is missing or wrong.
export function flightFromForm(
  form: FlightForm,
  id: string,
  now: Date,
): FlightRecord | null {
  const cost = form.costAmount.replace(/[,\s$¥]/g, "");
  const parsed = FlightRecordSchema.safeParse({
    id,
    airline: form.airline.trim(),
    flightNumber: form.flightNumber.trim().toUpperCase(),
    departDate: form.departDate,
    departTime: form.departTime,
    departAirport: form.departAirport.trim().toUpperCase(),
    departCity: orNull(form.departCity),
    arriveDate: form.arriveDate,
    arriveTime: form.arriveTime,
    arriveAirport: form.arriveAirport.trim().toUpperCase(),
    arriveCity: orNull(form.arriveCity),
    confirmation: orNull(form.confirmation)?.toUpperCase() ?? null,
    costAmount: cost === "" ? null : Number(cost),
    costCurrency: form.costCurrency,
    note: orNull(form.note),
    archived: false,
    updatedAt: now.toISOString(),
  });
  return parsed.success ? parsed.data : null;
}
