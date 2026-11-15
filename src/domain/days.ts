import type { Stay, TripDates } from "./schemas";

export type TripDay = {
  date: string; // YYYY-MM-DD
  cityIds: string[]; // one city, or two on a transfer day
  stays: Stay[];
};

// Calendar dates are plain YYYY-MM-DD strings, so they are compared and
// stepped in UTC to avoid any time-zone drift.
export function toUtcDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(date: string, count: number): string {
  const value = toUtcDate(date);
  value.setUTCDate(value.getUTCDate() + count);
  return fromUtcDate(value);
}

function nextDay(date: string): string {
  return addDays(date, 1);
}

// A day belongs to every stay whose check-in to check-out range contains it,
// both ends included. So a transfer day (check-out of one hotel, check-in of
// the next) belongs to both cities.
//
// With the trip's own dates, the days run from the earlier of its start and
// the first check-in to the later of its end and the last check-out. Days no
// hotel covers have no city and no stay. Without dates the hotels alone
// decide, as they did before trips had dates.
export function deriveDays(stays: Stay[], range?: TripDates | null): TripDay[] {
  const starts = stays.map((s) => s.checkIn);
  const ends = stays.map((s) => s.checkOut);
  if (range && range.startDate <= range.endDate) {
    starts.push(range.startDate);
    ends.push(range.endDate);
  }
  if (starts.length === 0) return [];
  const first = starts.reduce((a, d) => (d < a ? d : a));
  const last = ends.reduce((a, d) => (d > a ? d : a));

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

// Whether a place in this city can go on this day: the day is in that city,
// or no hotel covers it yet, so it takes places from any city.
export function dayTakesCity(
  day: Pick<TripDay, "cityIds">,
  cityId: string,
): boolean {
  return day.cityIds.length === 0 || day.cityIds.includes(cityId);
}

// The cities whose places suit a day: its own, or every city when no hotel
// covers it yet.
export function dayPlaceCities(
  day: Pick<TripDay, "cityIds">,
  allCityIds: string[],
): string[] {
  return day.cityIds.length > 0 ? day.cityIds : allCityIds;
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
