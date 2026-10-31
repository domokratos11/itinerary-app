import type { PlanItem } from "./schemas";

// Screens talk to the plan only through this interface. The Firestore
// implementation is in src/lib; a memory version is used in tests.
export interface PlanRepository {
  // Calls onItems with the full list now and after every change. onError is
  // called if the connection is refused (for example, rules not published).
  // Returns a function that stops listening.
  subscribe(
    tripId: string,
    onItems: (items: PlanItem[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  // Creates or replaces one plan item.
  save(tripId: string, item: PlanItem): Promise<void>;
}

// The item stays in the plan with status "removed", so it can be restored and
// shows up in "Recently changed", until Clean up in Settings deletes it.
export function markRemoved(item: PlanItem, now: Date = new Date()): PlanItem {
  return { ...item, status: "removed", updatedAt: now.toISOString() };
}
