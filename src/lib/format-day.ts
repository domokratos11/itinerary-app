import { intlLocale } from "@/lib/i18n";

// Trip dates are YYYY-MM-DD and are formatted in UTC so no time zone shifts them.
export function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(intlLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// An instant such as a link's expiry, as the date and time in Tokyo.
export function formatTokyoDateTime(iso: string): string {
  return new Date(iso).toLocaleString(intlLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
    timeZoneName: "short",
  });
}

const FULL_DATE: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
};

// A YYYY-MM-DD date with its year, such as "Nov 12, 2026".
export function formatFullDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(
    intlLocale(),
    FULL_DATE,
  );
}

// Two YYYY-MM-DD dates as one range, such as "Dec 15, 2026 – Jan 12, 2027";
// the language decides what the two share (the year, the month).
export function formatDateRange(start: string, end: string): string {
  return new Intl.DateTimeFormat(intlLocale(), FULL_DATE).formatRange(
    new Date(`${start}T00:00:00Z`),
    new Date(`${end}T00:00:00Z`),
  );
}
