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
