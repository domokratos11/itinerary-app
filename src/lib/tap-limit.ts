import { todayInTokyo } from "@/lib/tokyo-date";

// A per-device daily limit on Google's paid-tier features: a cap in the Cloud
// console can't target one price tier. Opening a place uses one of each, and
// lib/place-live-cache leaves out reopening one, so this is room for a day of
// planning while keeping a runaway loop far from the 1,000-a-month allowance.
export const TAP_LIMITS = { live: 30, photo: 30 } as const;

export type TapKind = keyof typeof TAP_LIMITS;

const KEY = "maps-taps";
type Counts = { date: string; live: number; photo: number };

// Storage can be missing or blocked, and the limit still has to hold.
let memory: Counts | null = null;

function read(today: string): Counts {
  let stored: Counts | null = memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw) as Counts;
  } catch {
    // Falls back to the count kept in memory.
  }
  return stored?.date === today ? stored : { date: today, live: 0, photo: 0 };
}

// Counts one use and says whether it's allowed. The day follows Japan time.
export function tryTap(kind: TapKind, now: Date = new Date()): boolean {
  const counts = read(todayInTokyo(now));
  if (counts[kind] >= TAP_LIMITS[kind]) return false;
  const next = { ...counts, [kind]: counts[kind] + 1 };
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Kept in memory for this session.
  }
  return true;
}
