import type { PlanItem } from "./schemas";

// Screens talk to the plan only through this interface. The Firestore
// implementation is in src/lib; a memory version is used in tests.
export interface PlanRepository {
  // Calls onItems with the full list now and after every change.
  // Returns a function that stops listening.
  subscribe(tripId: string, onItems: (items: PlanItem[]) => void): () => void;
  // Creates or replaces one plan item.
  save(tripId: string, item: PlanItem): Promise<void>;
}

// Soft delete: the item stays in the plan with status "removed", so it can
// be restored and shows up in "Recently changed".
export function markRemoved(item: PlanItem, now: Date = new Date()): PlanItem {
  return { ...item, status: "removed", updatedAt: now.toISOString() };
}
