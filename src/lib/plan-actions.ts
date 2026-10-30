import { markRemoved } from "@/domain/plan-repository";
import { newPlanItem, keysForInsert } from "@/domain/plan";
import type { PlanItem } from "@/domain/schemas";
import { usePlanStore } from "@/lib/plan-store";
import { planRepository } from "@/lib/plan-repository-instance";

// Every change to the plan goes through here, then through PlanRepository.
// Each function writes the whole item, so the Firestore rules see all fields.
// Changes are shown at once (the store is updated before the save), and the
// next snapshot from the repository replaces them, or undoes them if refused.
async function saveAll(tripId: string, items: PlanItem[]): Promise<void> {
  usePlanStore.getState().apply(items);
  await Promise.all(items.map((item) => planRepository.save(tripId, item)));
}

// The other items of the day whose key changed when the day was re-keyed.
function withKeys(
  others: PlanItem[],
  rekeyed: { id: string; order: string }[],
  now: Date,
): PlanItem[] {
  const byId = new Map(others.map((i) => [i.id, i]));
  return rekeyed.flatMap(({ id, order }) => {
    const item = byId.get(id);
    return item ? [{ ...item, order, updatedAt: now.toISOString() }] : [];
  });
}

export async function addPlaceToDay(
  tripId: string,
  placeId: string,
  date: string,
  dayItems: PlanItem[],
  now: Date = new Date(),
): Promise<PlanItem> {
  return addPlaceAt(tripId, placeId, date, dayItems.length, dayItems, now);
}

// Adds a new stop at `index` in the day's list (`dayItems`, in order) and
// returns it, so the caller can offer Undo.
export async function addPlaceAt(
  tripId: string,
  placeId: string,
  date: string,
  index: number,
  dayItems: PlanItem[],
  now: Date = new Date(),
): Promise<PlanItem> {
  const { order, rekeyed } = keysForInsert(dayItems, index);
  const item = newPlanItem({
    id: crypto.randomUUID(),
    placeId,
    date,
    order,
    now,
  });
  await saveAll(tripId, [item, ...withKeys(dayItems, rekeyed, now)]);
  return item;
}

// Puts an item on `date` at `index`. `others` is that day's items without
// this one, already in order.
export async function placeItem(
  tripId: string,
  item: PlanItem,
  date: string,
  index: number,
  others: PlanItem[],
  now: Date = new Date(),
): Promise<void> {
  const { order, rekeyed } = keysForInsert(others, index);
  await saveAll(tripId, [
    { ...item, date, order, updatedAt: now.toISOString() },
    ...withKeys(others, rekeyed, now),
  ]);
}

export async function removeItem(
  tripId: string,
  item: PlanItem,
  now: Date = new Date(),
): Promise<void> {
  await saveAll(tripId, [markRemoved(item, now)]);
}

// Restores an item exactly as it was before it was removed (used by Undo).
export async function restoreItem(
  tripId: string,
  previous: PlanItem,
): Promise<void> {
  await saveAll(tripId, [previous]);
}
