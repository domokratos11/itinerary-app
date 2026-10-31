import type { Translate } from "./i18n";
import { parseHours } from "./plan";

export type HoursPoint = { day: number; hour: number; minute: number };
export type HoursPeriod = { open: HoursPoint; close: HoursPoint | null };

const MINUTES_IN_WEEK = 7 * 24 * 60;

const minuteOfWeek = (p: HoursPoint) => (p.day * 24 + p.hour) * 60 + p.minute;

// Whether a place is open now, from Google's opening periods and its UTC
// offset, or null when it publishes no hours. Holidays aren't in the periods.
// Worked out here because Place.isOpen() throws outside Google's beta channel.
export function openNowFrom(
  periods: HoursPeriod[],
  utcOffsetMinutes: number | null | undefined,
  now: Date,
): boolean | null {
  if (periods.length === 0 || utcOffsetMinutes == null) return null;
  const local = new Date(now.getTime() + utcOffsetMinutes * 60_000);
  const current = minuteOfWeek({
    day: local.getUTCDay(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  });
  return periods.some(({ open, close }) => {
    // No closing time means open around the clock.
    if (!close) return true;
    const start = minuteOfWeek(open);
    let end = minuteOfWeek(close);
    // A period running past Saturday midnight wraps into the next week.
    if (end <= start) end += MINUTES_IN_WEEK;
    return [current, current + MINUTES_IN_WEEK].some(
      (at) => at >= start && at < end,
    );
  });
}

function to24Hour(hour: number, minute: string, meridiem: string): string {
  const upper = meridiem.toUpperCase();
  const h =
    upper === "PM" ? (hour % 12) + 12 : upper === "AM" ? hour % 12 : hour;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

// Today's first range from Google's text, such as "9:30 AM – 5:00 PM", where
// the first AM or PM can be left out when both are the same.
export function parseGoogleHours(
  text: string,
): { open: string; close: string } | null {
  const match = text.match(
    /(\d{1,2}):(\d{2})\s*([AP]M)?\s*[–—-]\s*(\d{1,2}):(\d{2})\s*([AP]M)?/i,
  );
  if (!match) return null;
  const closeMeridiem = match[6] ?? "";
  return {
    open: to24Hour(Number(match[1]), match[2], match[3] ?? closeMeridiem),
    close: to24Hour(Number(match[4]), match[5], closeMeridiem),
  };
}

// Why Google's hours for today don't fit our stored ones, or null when they
// agree or can't be compared. Stored hours are free text, so this is a prompt
// to look closer, not a verdict.
export function hoursDifference(
  stored: string | null,
  googleToday: string | null,
  tr: Translate,
): string | null {
  if (!googleToday) return null;
  const ours = parseHours(stored);
  if (!ours) return null;
  if (/^closed$/i.test(googleToday.trim())) return tr("live.closedVsNotes");
  const theirs = parseGoogleHours(googleToday);
  if (!theirs) return null;
  if (theirs.open === ours.open && theirs.close === ours.close) return null;
  return tr("live.notesDiffer", { open: ours.open, close: ours.close });
}
