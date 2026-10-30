import { itemsForDay } from "@/domain/plan";
import { draftPlaceFrom, type QueuedPlace } from "@/domain/queue";
import type { PlaceRecord } from "@/domain/schemas";
import { addPlaceToDay } from "@/lib/plan-actions";
import { usePlanStore } from "@/lib/plan-store";
import { queueRepository } from "@/lib/queue-repository-instance";
import { saveRecord } from "@/lib/trip-actions";
import { useTripStore } from "@/lib/trip-store";

// Adds one link to the trip's queue. The id and time are set here, so every
// write has the same shape the rules expect.
export function queueAdd(
  tripId: string,
  input: Pick<QueuedPlace, "url" | "name" | "lat" | "lng" | "note">,
  now: Date = new Date(),
): Promise<void> {
  return queueRepository.save(tripId, {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    status: "queued",
    cityId: null,
    placeId: null,
    updatedAt: now.toISOString(),
  });
}

// Saves an edited item (name, note, city or status).
export function queueUpdate(
  tripId: string,
  item: QueuedPlace,
  changes: Partial<Pick<QueuedPlace, "name" | "note" | "cityId" | "status">>,
  now: Date = new Date(),
): Promise<void> {
  return queueRepository.save(tripId, {
    ...item,
    ...changes,
    updatedAt: now.toISOString(),
  });
}

// Turns a queued link into a draft place in `cityId` and, when a date is
// given, puts it at the end of that day. The queue item is marked promoted
// and remembers the place, so the next enrichment run can research it.
export async function assignQueued(
  tripId: string,
  item: QueuedPlace,
  cityId: string,
  date: string | null,
  now: Date = new Date(),
): Promise<PlaceRecord> {
  const places = useTripStore.getState().data.places;
  const existing = item.placeId
    ? places.find((p) => p.id === item.placeId)
    : undefined;
  const place =
    existing ??
    draftPlaceFrom(
      item,
      {
        cityId,
        name: item.name ?? "Queued place",
        takenIds: places.map((p) => p.id),
      },
      now,
    );
  const writes: Promise<void>[] = [];
  if (!existing) writes.push(saveRecord(tripId, "places", place));
  if (date) {
    const dayItems = itemsForDay(usePlanStore.getState().items, date);
    writes.push(addPlaceToDay(tripId, place.id, date, dayItems, now));
  }
  writes.push(
    queueRepository.save(tripId, {
      ...item,
      cityId: place.cityId,
      placeId: place.id,
      status: "promoted",
      updatedAt: now.toISOString(),
    }),
  );
  await Promise.all(writes);
  return place;
}
