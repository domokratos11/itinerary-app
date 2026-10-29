import type { QueuedPlace } from "@/domain/queue";
import { queueRepository } from "@/lib/queue-repository-instance";

// Adds one link to the trip's queue. The id and time are set here, so every
// write has the same shape the rules expect.
export function queueAdd(
  tripId: string,
  input: Pick<QueuedPlace, "url" | "name" | "lat" | "lng" | "note">,
  now: Date = new Date(),
): Promise<void> {
  return queueRepository.add(tripId, {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
  });
}
