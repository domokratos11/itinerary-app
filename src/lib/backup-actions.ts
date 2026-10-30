import type { Backup } from "@/domain/backup";
import { TRIP_COLLECTIONS } from "@/domain/trip";
import { logActivity } from "@/lib/activity-log";
import { planRepository } from "@/lib/plan-repository-instance";
import { queueRepository } from "@/lib/queue-repository-instance";
import { tripRepository } from "@/lib/trip-repository-instance";

// Writes a backup into the trip: cities, stays, reservations and places in
// write batches, then the plan and the queue. Only used on an empty trip.
export async function importBackup(
  tripId: string,
  backup: Backup,
): Promise<void> {
  for (const name of TRIP_COLLECTIONS)
    if (backup[name].length)
      await tripRepository.saveMany(tripId, name, backup[name]);
  await Promise.all([
    ...backup.items.map((item) => planRepository.save(tripId, item)),
    ...backup.queue.map((item) => queueRepository.save(tripId, item)),
  ]);
  logActivity(tripId, {
    kind: "settings",
    targetId: null,
    summary: `restored a backup from ${backup.exportedAt.slice(0, 10)}`,
  });
}
