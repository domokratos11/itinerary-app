import type { PlanRepository } from "@/domain/plan-repository";
import type { PlanItem } from "@/domain/schemas";

// In-memory plan for tests and previews. Same behaviour as the Firestore
// version: subscribers get the full list on subscribe and after each save.
export class LocalPlanRepository implements PlanRepository {
  private trips = new Map<string, Map<string, PlanItem>>();
  private listeners = new Map<string, Set<(items: PlanItem[]) => void>>();

  subscribe(tripId: string, onItems: (items: PlanItem[]) => void): () => void {
    const set = this.listeners.get(tripId) ?? new Set();
    set.add(onItems);
    this.listeners.set(tripId, set);
    onItems(this.list(tripId));
    return () => {
      set.delete(onItems);
    };
  }

  async save(tripId: string, item: PlanItem): Promise<void> {
    const items = this.trips.get(tripId) ?? new Map<string, PlanItem>();
    items.set(item.id, item);
    this.trips.set(tripId, items);
    for (const listener of this.listeners.get(tripId) ?? []) {
      listener(this.list(tripId));
    }
  }

  private list(tripId: string): PlanItem[] {
    return [...(this.trips.get(tripId)?.values() ?? [])];
  }
}
