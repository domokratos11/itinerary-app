import { itemsForDay } from "@/domain/plan";
import { draftPlaceFrom, type QueuedPlace } from "@/domain/queue";
import type { PlaceRecord, PlanItem } from "@/domain/schemas";
import { logActivity } from "@/lib/activity-log";
import { formatDayLabel } from "@/lib/format-day";
import { addPlaceAt } from "@/lib/plan-actions";
import { usePlanStore } from "@/lib/plan-store";
import { queueRepository } from "@/lib/queue-repository-instance";
import { saveRecord } from "@/lib/trip-actions";
import { useTripStore } from "@/lib/trip-store";

// Adds one link to the trip's queue. The id and time are set here, so every
// write has the same shape the rules expect.
export async function queueAdd(
  tripId: string,
  input: Pick<QueuedPlace, "url" | "name" | "lat" | "lng" | "note"> &
    Partial<Pick<QueuedPlace, "category">>,
  now: Date = new Date(),
): Promise<void> {
  const id = crypto.randomUUID();
  await queueRepository.save(tripId, {
    category: null,
    ...input,
    id,
    createdAt: now.toISOString(),
    status: "queued",
    cityId: null,
    placeId: null,
    updatedAt: now.toISOString(),
  });
  logActivity(
    tripId,
    {
      kind: "queued",
      targetId: id,
      summary: `queued ${input.name ?? "a link"}`,
    },
    now,
  );
}

// Saves an edited item (name, note, city, category or status).
export async function queueUpdate(
  tripId: string,
  item: QueuedPlace,
  changes: Partial<
    Pick<QueuedPlace, "name" | "note" | "cityId" | "category" | "status">
  >,
  now: Date = new Date(),
): Promise<void> {
  await queueRepository.save(tripId, {
    ...item,
    ...changes,
    updatedAt: now.toISOString(),
  });
  const name = changes.name ?? item.name ?? "a link";
  const summary =
    changes.status === "dismissed"
      ? `dismissed ${name}`
      : changes.status === "queued" && item.status !== "queued"
        ? `put ${name} back in the queue`
        : `edited queued ${name}`;
  logActivity(
    tripId,
    {
      kind: changes.status === "dismissed" ? "dismissed" : "queued",
      targetId: item.id,
      summary,
    },
    now,
  );
}

// Turns a queued link into a draft place in `cityId` and, when a date is
// given, puts it on that day (at `index`, or the end). The queue item is
// marked promoted and remembers the place, so the next enrichment run can
// research it. Returns the place and the new stop, if any.
export async function assignQueued(
  tripId: string,
  item: QueuedPlace,
  cityId: string,
  date: string | null,
  now: Date = new Date(),
  index?: number,
): Promise<{ place: PlaceRecord; stop: PlanItem | null }> {
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
  const writes: Promise<unknown>[] = [];
  if (!existing) writes.push(saveRecord(tripId, "places", place));
  const adding = date
    ? (() => {
        const dayItems = itemsForDay(usePlanStore.getState().items, date);
        return addPlaceAt(
          tripId,
          place.id,
          date,
          index ?? dayItems.length,
          dayItems,
          now,
        );
      })()
    : Promise.resolve(null);
  writes.push(adding);
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
  logActivity(
    tripId,
    {
      kind: "assigned",
      targetId: item.id,
      summary: date
        ? `assigned ${place.name} to ${formatDayLabel(date)}`
        : `added ${place.name} to the city list`,
    },
    now,
  );
  return { place, stop: await adding };
}
