import type { QueuedPlace } from "./queue";

// Links waiting for the next enrichment run. Like the plan, screens use this
// interface and never the Firebase SDK.
export interface QueueRepository {
  subscribe(
    tripId: string,
    onItems: (items: QueuedPlace[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  add(tripId: string, item: QueuedPlace): Promise<void>;
}
