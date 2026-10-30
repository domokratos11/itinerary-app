import type { QueueRepository } from "@/domain/queue-repository";
import type { QueuedPlace } from "@/domain/queue";

// In-memory queue for tests and previews, newest first like Firestore's.
export class LocalQueueRepository implements QueueRepository {
  private trips = new Map<string, Map<string, QueuedPlace>>();
  private listeners = new Map<string, Set<(items: QueuedPlace[]) => void>>();

  subscribe(
    tripId: string,
    onItems: (items: QueuedPlace[]) => void,
  ): () => void {
    const set = this.listeners.get(tripId) ?? new Set();
    set.add(onItems);
    this.listeners.set(tripId, set);
    onItems(this.list(tripId));
    return () => {
      set.delete(onItems);
    };
  }

  async save(tripId: string, item: QueuedPlace): Promise<void> {
    const items = this.trips.get(tripId) ?? new Map<string, QueuedPlace>();
    items.set(item.id, item);
    this.trips.set(tripId, items);
    for (const listener of this.listeners.get(tripId) ?? [])
      listener(this.list(tripId));
  }

  private list(tripId: string): QueuedPlace[] {
    return [...(this.trips.get(tripId)?.values() ?? [])].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  }
}
