import { makeBackup, type Backup } from "@/domain/backup";
import type { DayResearch, PlanItem, Proposal } from "@/domain/schemas";
import type { TripData } from "@/domain/trip";
import type { TripSummary } from "@/domain/trip-repository";
import { TRIP_COLLECTIONS } from "@/domain/trip";
import { t } from "@/lib/i18n";
import { activityRepository } from "@/lib/activity-repository-instance";
import { logActivity } from "@/lib/activity-log";
import { cleanupRepository } from "@/lib/firestore-cleanup-repository";
import { planRepository } from "@/lib/plan-repository-instance";
import { dayResearchRepository } from "@/lib/day-research-repository-instance";
import { proposalRepository } from "@/lib/proposal-repository-instance";
import { tripRepository } from "@/lib/trip-repository-instance";

// Everything in the trip. The stores already hold the records; the history
// and the old Queue's links are read only now, as no screen needs all of them.
export async function collectBackup(
  tripId: string,
  trip: TripSummary | null,
  data: TripData,
  items: PlanItem[],
  proposals: Proposal[],
  dayResearch: DayResearch[] = [],
): Promise<Backup> {
  const [activity, queue] = await Promise.all([
    activityRepository.all(tripId),
    cleanupRepository.queueLinks(tripId),
  ]);
  return makeBackup(data, items, new Date(), proposals, {
    trip: trip && {
      name: trip.name,
      members: trip.members,
      budget: trip.budget ?? null,
    },
    activity,
    queue,
    dayResearch,
  });
}

// Writes a backup into the trip: its records in write batches, then the plan,
// budget and history. Only used on an empty trip.
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
  await Promise.all(
    backup.dayResearch.map((row) => dayResearchRepository.save(tripId, row)),
  );
  if (backup.trip?.budget)
    await tripRepository.updateTrip(tripId, { budget: backup.trip.budget });
  if (backup.activity.length)
    await activityRepository.saveMany(tripId, backup.activity);
  logActivity(tripId, {
    kind: "settings",
    targetId: null,
    summary: t("activity.restoredBackup", {
      date: backup.exportedAt.slice(0, 10),
    }),
  });
}
