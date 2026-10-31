// "Today" and all trip dates use Japan time, not the phone's time zone.
const TOKYO = "Asia/Tokyo";

// The English name of the day in Tokyo, such as "Monday".
export function weekdayInTokyo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO,
    weekday: "long",
  }).format(now);
}

// YYYY-MM-DD for the given instant, as the calendar date in Tokyo.
export function todayInTokyo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
