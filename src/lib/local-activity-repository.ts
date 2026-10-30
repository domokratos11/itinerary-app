import type { Activity, ActivityRepository } from "@/domain/activity";

// In-memory activity log for tests and previews.
export class LocalActivityRepository implements ActivityRepository {
  private trips = new Map<string, Activity[]>();
  private listeners = new Map<string, Set<() => void>>();

  subscribe(
    tripId: string,
    limit: number,
    onEntries: (entries: Activity[]) => void,
  ): () => void {
    const notify = () => onEntries(this.newest(tripId, limit));
    const set = this.listeners.get(tripId) ?? new Set();
    set.add(notify);
    this.listeners.set(tripId, set);
    notify();
    return () => {
      set.delete(notify);
    };
  }

  async add(tripId: string, entry: Activity): Promise<void> {
    this.trips.set(tripId, [...(this.trips.get(tripId) ?? []), entry]);
    for (const notify of this.listeners.get(tripId) ?? []) notify();
  }

  private newest(tripId: string, limit: number): Activity[] {
    return [...(this.trips.get(tripId) ?? [])]
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, limit);
  }
}
