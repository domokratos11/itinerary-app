import type { DayResearchRepository } from "@/domain/day-research";
import type { DayResearch } from "@/domain/schemas";

// In-memory day research for tests and previews.
export class LocalDayResearchRepository implements DayResearchRepository {
  private trips = new Map<string, Map<string, DayResearch>>();
  private listeners = new Map<string, Set<(rows: DayResearch[]) => void>>();

  subscribe(tripId: string, onRows: (rows: DayResearch[]) => void) {
    const set = this.listeners.get(tripId) ?? new Set();
    set.add(onRows);
    this.listeners.set(tripId, set);
    onRows(this.list(tripId));
    return () => {
      set.delete(onRows);
    };
  }

  async save(tripId: string, row: DayResearch): Promise<void> {
    const rows = this.trips.get(tripId) ?? new Map<string, DayResearch>();
    rows.set(row.id, row);
    this.trips.set(tripId, rows);
    for (const listener of this.listeners.get(tripId) ?? [])
      listener(this.list(tripId));
  }

  private list(tripId: string): DayResearch[] {
    return [...(this.trips.get(tripId)?.values() ?? [])];
  }
}
