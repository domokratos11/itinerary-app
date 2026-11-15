import type { TripSummary } from "@/domain/trip-repository";
import { TRIP_COLLECTIONS } from "@/domain/trip";
import type { CopySource, TripCopy } from "@/domain/trip-copy";
import { logActivity } from "@/lib/activity-log";
import { t } from "@/lib/i18n";
import { planRepository } from "@/lib/plan-repository-instance";
import { tripRepository } from "@/lib/trip-repository-instance";

// Reads another itinerary once, for copying from it. The person is a member
// of it, so the rules let them read it; nothing in it is ever written.
export async function readCopySource(source: TripSummary): Promise<CopySource> {
  const [data, items] = await Promise.all([
    tripRepository.readTrip(source.id),
    planRepository.readItems(source.id),
  ]);
  return { summary: source, data, items };
}

// Writes what copyTrip returned into the target: its records in write
// batches (cities before what sits in them), then the stops, then the trip
// document's budget and members. A failure midway leaves what was written.
export async function writeTripCopy(
  tripId: string,
  copy: TripCopy,
  sourceName: string,
): Promise<void> {
  for (const name of TRIP_COLLECTIONS)
    if (copy.records[name].length)
      await tripRepository.saveMany(tripId, name, copy.records[name]);
  await Promise.all(
    copy.items.map((item) => planRepository.save(tripId, item)),
  );
  if (copy.changes.budget || copy.changes.members)
    await tripRepository.updateTrip(tripId, {
      ...(copy.changes.budget && { budget: copy.changes.budget }),
      ...(copy.changes.members && { members: copy.changes.members }),
    });
  logActivity(tripId, {
    kind: "settings",
    targetId: null,
    summary: t("activity.copiedItinerary", { name: sourceName }),
  });
}
