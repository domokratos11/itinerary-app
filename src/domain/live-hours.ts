import { parseHours } from "./plan";

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
): string | null {
  if (!googleToday) return null;
  const ours = parseHours(stored);
  if (!ours) return null;
  if (/^closed$/i.test(googleToday.trim()))
    return "Google says it's closed today, but our notes give opening hours.";
  const theirs = parseGoogleHours(googleToday);
  if (!theirs) return null;
  if (theirs.open === ours.open && theirs.close === ours.close) return null;
  return `Our notes say ${ours.open}–${ours.close}. Check before relying on either.`;
}
