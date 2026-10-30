import type { TripCollection, TripRecordOf } from "@/domain/trip";
import { logActivity } from "@/lib/activity-log";
import { tripRepository } from "@/lib/trip-repository-instance";
import { useTripStore } from "@/lib/trip-store";

// Every change to cities, stays, reservations and places goes through
// here, then through TripRepository. The change shows at once; the next
// snapshot replaces it, or undoes it if the rules refuse the write.
//
// A collection still showing the bundled seed has nothing in Firestore yet.
// Saving one record there would make it the whole list, so the first save
// copies the rest of the seed collection in as well.
//
// A `summary` ("updated the stay at KOKO Hotel") goes to the activity log;
// changes made as part of another action leave it out.
export async function saveRecord<C extends TripCollection>(
  tripId: string,
  collection: C,
  record: TripRecordOf[C],
  summary?: string,
): Promise<void> {
  const state = useTripStore.getState();
  const rest = state.live[collection]
    ? []
    : (state.data[collection] as TripRecordOf[C][]).filter(
        (r) => r.id !== record.id,
      );
  state.apply(collection, record);
  if (rest.length === 0) await tripRepository.save(tripId, collection, record);
  else await tripRepository.saveMany(tripId, collection, [...rest, record]);
  if (summary)
    logActivity(tripId, { kind: "settings", targetId: record.id, summary });
}

// Records are never deleted, only hidden.
export function archiveRecord<C extends TripCollection>(
  tripId: string,
  collection: C,
  record: TripRecordOf[C],
  summary?: string,
  now: Date = new Date(),
): Promise<void> {
  return saveRecord(
    tripId,
    collection,
    { ...record, archived: true, updatedAt: now.toISOString() },
    summary,
  );
}
