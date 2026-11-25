import type { FoodCategory, FoodRepository, FoodSpot } from "@/domain/food";

// In-memory food categories and spots for tests and previews.
export class LocalFoodRepository implements FoodRepository {
  private categories = new Table<FoodCategory>();
  private spots = new Table<FoodSpot>();

  subscribeCategories(tripId: string, onRows: (rows: FoodCategory[]) => void) {
    return this.categories.subscribe(tripId, onRows);
  }

  subscribeSpots(tripId: string, onRows: (rows: FoodSpot[]) => void) {
    return this.spots.subscribe(tripId, onRows);
  }

  async saveCategory(tripId: string, row: FoodCategory): Promise<void> {
    this.categories.save(tripId, row);
  }

  async saveSpot(tripId: string, row: FoodSpot): Promise<void> {
    this.spots.save(tripId, row);
  }
}

class Table<T extends { id: string }> {
  private trips = new Map<string, Map<string, T>>();
  private listeners = new Map<string, Set<(rows: T[]) => void>>();

  subscribe(tripId: string, onRows: (rows: T[]) => void) {
    const set = this.listeners.get(tripId) ?? new Set();
    set.add(onRows);
    this.listeners.set(tripId, set);
    onRows(this.list(tripId));
    return () => {
      set.delete(onRows);
    };
  }

  save(tripId: string, row: T) {
    const rows = this.trips.get(tripId) ?? new Map<string, T>();
    rows.set(row.id, row);
    this.trips.set(tripId, rows);
    for (const listener of this.listeners.get(tripId) ?? [])
      listener(this.list(tripId));
  }

  private list(tripId: string): T[] {
    return [...(this.trips.get(tripId)?.values() ?? [])];
  }
}
