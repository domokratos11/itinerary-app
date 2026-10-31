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
