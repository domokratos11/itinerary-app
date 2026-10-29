// "Today" and all trip dates use Japan time, not the phone's time zone.
const TOKYO = "Asia/Tokyo";

// YYYY-MM-DD for the given instant, as the calendar date in Tokyo.
export function todayInTokyo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
