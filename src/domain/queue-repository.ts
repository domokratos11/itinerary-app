import type { QueuedPlace } from "./queue";

// Links waiting to be assigned or researched. Like the plan, screens use
// this interface and never the Firebase SDK.
export interface QueueRepository {
  subscribe(
    tripId: string,
    onItems: (items: QueuedPlace[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  // Creates or replaces one item. Items are dismissed, never deleted.
  save(tripId: string, item: QueuedPlace): Promise<void>;
}
