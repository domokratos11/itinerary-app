import { markRemoved } from "@/domain/plan-repository";
import { newPlanItem, keyAt } from "@/domain/plan";
import type { PlanItem } from "@/domain/schemas";
import { planRepository } from "@/lib/plan-repository-instance";

// Every change to the plan goes through here, then through PlanRepository.
// Each function writes the whole item, so the Firestore rules see all fields.

export async function addPlaceToDay(
  tripId: string,
  placeId: string,
  date: string,
  dayItems: PlanItem[],
  now: Date = new Date(),
): Promise<void> {
  const item = newPlanItem({
    id: crypto.randomUUID(),
    placeId,
    date,
    order: keyAt(dayItems, dayItems.length),
    now,
  });
  await planRepository.save(tripId, item);
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
  await planRepository.save(tripId, {
    ...item,
    date,
    order: keyAt(others, index),
    updatedAt: now.toISOString(),
  });
}

export async function removeItem(
  tripId: string,
  item: PlanItem,
  now: Date = new Date(),
): Promise<void> {
  await planRepository.save(tripId, markRemoved(item, now));
}

// Restores an item exactly as it was before it was removed (used by Undo).
export async function restoreItem(
  tripId: string,
  previous: PlanItem,
): Promise<void> {
  await planRepository.save(tripId, previous);
}
