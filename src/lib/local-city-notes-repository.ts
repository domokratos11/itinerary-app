import type { CityNotes, CityNotesRepository } from "@/domain/city-notes";

// In-memory city notes for tests and previews.
export class LocalCityNotesRepository implements CityNotesRepository {
  private trips = new Map<string, Map<string, CityNotes>>();
  private listeners = new Map<string, Set<(rows: CityNotes[]) => void>>();

  subscribe(tripId: string, onRows: (rows: CityNotes[]) => void) {
    const set = this.listeners.get(tripId) ?? new Set();
    set.add(onRows);
    this.listeners.set(tripId, set);
    onRows(this.list(tripId));
    return () => {
      set.delete(onRows);
    };
  }

  async save(tripId: string, row: CityNotes): Promise<void> {
    const rows = this.trips.get(tripId) ?? new Map<string, CityNotes>();
    rows.set(row.id, row);
    this.trips.set(tripId, rows);
    for (const listener of this.listeners.get(tripId) ?? [])
      listener(this.list(tripId));
  }

  private list(tripId: string): CityNotes[] {
    return [...(this.trips.get(tripId)?.values() ?? [])];
  }
}
