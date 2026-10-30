import { deriveDays } from "./days";
import type { Place, PlanItem, Stay } from "./schemas";
import { strandedItems } from "./trip";

export type StayIssue = {
  kind: "gap" | "overlap";
  from: string; // YYYY-MM-DD
  to: string;
  between: [string, string]; // the two stays' ids
};

// Nights not covered by any hotel (gap) or covered by two (overlap),
// checking each stay against the next one by check-in. A stay's check-out
// may equal the next check-in: that's a normal transfer day.
export function stayIssues(
  stays: (Pick<Stay, "checkIn" | "checkOut"> & { id: string })[],
): StayIssue[] {
  const sorted = [...stays].sort((a, b) =>
    a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0,
  );
  const issues: StayIssue[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (prev.checkOut < next.checkIn)
      issues.push({
        kind: "gap",
        from: prev.checkOut,
        to: next.checkIn,
        between: [prev.id, next.id],
      });
    else if (prev.checkOut > next.checkIn)
      issues.push({
        kind: "overlap",
        from: next.checkIn,
        to: prev.checkOut < next.checkOut ? prev.checkOut : next.checkOut,
        between: [prev.id, next.id],
      });
  }
  return issues;
}

export type DayChanges = {
  added: string[];
  removed: string[];
  // Active stops that would need a new day after the change.
  stranded: number;
};

// What saving `after` instead of `before` does to the trip's days, so the
// settings screen can say it before the change is made.
export function dayChanges(
  before: Stay[],
  after: Stay[],
  items: PlanItem[],
  places: Pick<Place, "id" | "cityId">[],
): DayChanges {
  const oldDays = new Set(deriveDays(before).map((d) => d.date));
  const newDays = deriveDays(after);
  const newDates = new Set(newDays.map((d) => d.date));
  const strandedBefore = new Set(
    strandedItems(items, deriveDays(before), places).map((s) => s.item.id),
  );
  const strandedAfter = strandedItems(items, newDays, places).filter(
    (s) => !strandedBefore.has(s.item.id),
  );
  return {
    added: [...newDates].filter((d) => !oldDays.has(d)).sort(),
    removed: [...oldDays].filter((d) => !newDates.has(d)).sort(),
    stranded: strandedAfter.length,
  };
}

// A lowercase id from a name ("Kyoto (Gion)" -> "kyoto-gion"), with a
// number added if it's already taken.
export function uniqueId(name: string, taken: Iterable<string>): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!used.has(id)) return id;
  }
}
