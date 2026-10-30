import type { ActivityKind } from "@/domain/activity";
import type { PlanItem } from "@/domain/schemas";
import { activityRepository } from "@/lib/activity-repository-instance";
import { getDeviceName } from "@/lib/device-name";
import { useTripStore } from "@/lib/trip-store";

// Writes one activity entry. Logging never blocks or fails a change: a
// refused or offline write only loses the entry.
export function logActivity(
  tripId: string,
  entry: {
    kind: ActivityKind;
    targetId: string | null;
    summary: string;
    before?: PlanItem | null;
    after?: PlanItem | null;
  },
  now: Date = new Date(),
): void {
  activityRepository
    .add(tripId, {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      device: getDeviceName(),
      kind: entry.kind,
      targetId: entry.targetId,
      summary: entry.summary.slice(0, 300),
      before: entry.before ? JSON.stringify(entry.before) : null,
      after: entry.after ? JSON.stringify(entry.after) : null,
    })
    .catch(() => {});
}

// "Nagoya Castle", for summaries.
export function placeName(placeId: string): string {
  return (
    useTripStore.getState().data.places.find((p) => p.id === placeId)?.name ??
    placeId
  );
}
