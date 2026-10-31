import type { Backup } from "@/domain/backup";
import { TRIP_COLLECTIONS } from "@/domain/trip";
import { t } from "@/lib/i18n";
import { logActivity } from "@/lib/activity-log";
import { planRepository } from "@/lib/plan-repository-instance";
import { proposalRepository } from "@/lib/proposal-repository-instance";
import { tripRepository } from "@/lib/trip-repository-instance";

// Writes a backup into the trip: cities, stays, reservations and places in
// write batches, then the plan. Only used on an empty trip.
export async function importBackup(
  tripId: string,
  backup: Backup,
): Promise<void> {
  for (const name of TRIP_COLLECTIONS)
    if (backup[name].length)
      await tripRepository.saveMany(tripId, name, backup[name]);
  await Promise.all(
    backup.items.map((item) => planRepository.save(tripId, item)),
  );
  if (backup.proposals.length)
    await proposalRepository.saveMany(tripId, backup.proposals);
  logActivity(tripId, {
    kind: "settings",
    targetId: null,
    summary: t("activity.restoredBackup", {
      date: backup.exportedAt.slice(0, 10),
    }),
  });
}
