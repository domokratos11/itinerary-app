import type { Stay } from "./schemas";

export type TripDay = {
  date: string; // YYYY-MM-DD
  cityIds: string[]; // one city, or two on a transfer day
  stays: Stay[];
};

// Calendar dates are plain YYYY-MM-DD strings, so they are compared and
// stepped in UTC to avoid any time-zone drift.
function toUtcDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function nextDay(date: string): string {
  const value = toUtcDate(date);
  value.setUTCDate(value.getUTCDate() + 1);
  return fromUtcDate(value);
}

// A day belongs to every stay whose check-in to check-out range contains it,
// both ends included. So a transfer day (check-out of one hotel, check-in of
// the next) belongs to both cities.
export function deriveDays(stays: Stay[]): TripDay[] {
  if (stays.length === 0) return [];
  const first = stays.reduce(
    (a, s) => (s.checkIn < a ? s.checkIn : a),
    stays[0].checkIn,
  );
  const last = stays.reduce(
    (a, s) => (s.checkOut > a ? s.checkOut : a),
    stays[0].checkOut,
  );

  const days: TripDay[] = [];
  for (let date = first; date <= last; date = nextDay(date)) {
    const matching = stays.filter(
      (s) => s.checkIn <= date && date <= s.checkOut,
    );
    days.push({
      date,
      cityIds: matching.map((s) => s.cityId),
      stays: matching,
    });
  }
  return days;
}

export function weekdayOf(date: string): string {
  return toUtcDate(date).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export type TripPhase =
  | { phase: "before"; daysLeft: number; first: string }
  | { phase: "during"; date: string }
  | { phase: "after" };

// Where `today` (a Tokyo date) falls relative to the trip's days.
export function tripPhase(today: string, days: TripDay[]): TripPhase {
  if (days.length === 0) return { phase: "after" };
  const first = days[0].date;
  const last = days[days.length - 1].date;
  if (today < first) {
    const ms = toUtcDate(first).getTime() - toUtcDate(today).getTime();
    return { phase: "before", daysLeft: Math.round(ms / 86_400_000), first };
  }
  if (today > last) return { phase: "after" };
  return { phase: "during", date: today };
}
