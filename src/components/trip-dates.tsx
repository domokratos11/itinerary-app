"use client";

import { intlLocale } from "@/lib/i18n";
import { useTrip } from "@/lib/trip-store";

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(intlLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// First to last date of the trip, flights included.
export function TripDates() {
  const { stays, reservations } = useTrip();
  const dates = [
    ...stays.flatMap((s) => [s.checkIn, s.checkOut]),
    ...reservations.map((r) => r.date),
  ].sort();
  if (dates.length === 0) return null;
  return (
    <>
      {formatDate(dates[0])} – {formatDate(dates[dates.length - 1])}
    </>
  );
}
