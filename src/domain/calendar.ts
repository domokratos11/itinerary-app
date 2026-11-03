import { addDays, toUtcDate, type TripDay } from "./days";
import type { Stay } from "./schemas";
import { nightStay } from "./trip";

export type CalendarCell = {
  date: string; // YYYY-MM-DD
  day: TripDay | null; // null outside the trip
  // The day number alone isn't enough here: the first cell of the trip and
  // each 1st of the month also show the month's name.
  showMonth: boolean;
  // 0 for the trip's first month, 1 for the next, and so on, so months can
  // be shaded apart.
  monthIndex: number;
};

// Monday is 0.
function weekdayIndex(date: string): number {
  return (toUtcDate(date).getUTCDay() + 6) % 7;
}

function monthNumber(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return y * 12 + m;
}

// The trip as whole weeks, Monday to Sunday, with no break between months:
// from the Monday on or before the first day to the Sunday on or after the
// last.
export function calendarWeeks(days: TripDay[]): CalendarCell[][] {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const start = addDays(first, -weekdayIndex(first));
  const end = addDays(last, 6 - weekdayIndex(last));

  const weeks: CalendarCell[][] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (weekdayIndex(date) === 0) weeks.push([]);
    const day = byDate.get(date) ?? null;
    weeks[weeks.length - 1].push({
      date,
      day,
      showMonth: day !== null && (date === first || date.endsWith("-01")),
      monthIndex: Math.max(0, monthNumber(date) - monthNumber(first)),
    });
  }
  return weeks;
}

export type StayBand<S extends Stay = Stay> = {
  stay: S;
  start: number; // column, 0 = Monday
  span: number;
};

// The hotel of each night in one week, as runs of columns, so a stay can be
// drawn as one bar across its days. Days outside the trip have none.
export function stayBands<S extends Stay>(
  week: CalendarCell[],
  stays: S[],
): StayBand<S>[] {
  const bands: StayBand<S>[] = [];
  week.forEach((cell, column) => {
    const stay = cell.day ? nightStay(cell.date, stays) : null;
    if (!stay) return;
    const last = bands.at(-1);
    if (last && last.stay === stay && last.start + last.span === column)
      last.span += 1;
    else bands.push({ stay, start: column, span: 1 });
  });
  return bands;
}
