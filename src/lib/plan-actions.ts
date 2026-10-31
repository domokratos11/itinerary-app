import { undoFor, type Activity } from "@/domain/activity";
import { markRemoved } from "@/domain/plan-repository";
import { newPlanItem, keysForInsert } from "@/domain/plan";
import type { PlanItem } from "@/domain/schemas";
import { t } from "@/lib/i18n";
import { logActivity, placeName } from "@/lib/activity-log";
import { formatDayLabel } from "@/lib/format-day";
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
  logActivity(
    tripId,
    {
      kind: "added",
      targetId: item.id,
      summary: t("activity.addedToDay", {
        name: placeName(placeId),
        day: formatDayLabel(date),
      }),
      after: item,
    },
    now,
  );
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
  const moved = { ...item, date, order, updatedAt: now.toISOString() };
  await saveAll(tripId, [moved, ...withKeys(others, rekeyed, now)]);
  const name = placeName(item.placeId);
  logActivity(
    tripId,
    {
      kind: item.date === date ? "reordered" : "moved",
      targetId: item.id,
      summary:
        item.date === date
          ? t("activity.reordered", { name, day: formatDayLabel(date) })
          : t("activity.moved", {
              name,
              from: formatDayLabel(item.date),
              to: formatDayLabel(date),
            }),
      before: item,
      after: moved,
    },
    now,
  );
}

// Saves edited details of a stop (time, duration, note, done or skipped).
export async function updateItem(
  tripId: string,
  item: PlanItem,
  changes: Partial<
    Pick<PlanItem, "startTime" | "durationMin" | "note" | "status" | "legNote">
  >,
  now: Date = new Date(),
): Promise<void> {
  const updated = { ...item, ...changes, updatedAt: now.toISOString() };
  await saveAll(tripId, [updated]);
  const name = placeName(item.placeId);
  const day = formatDayLabel(item.date);
  const status = changes.status;
  const summary =
    status && status !== item.status && status !== "removed"
      ? t("activity.markedOn", {
          name,
          status: t(`common.${status}`).toLowerCase(),
          day,
        })
      : t("activity.editedOn", { name, day });
  logActivity(
    tripId,
    {
      kind: "edited",
      targetId: item.id,
      summary,
      before: item,
      after: updated,
    },
    now,
  );
}

export async function removeItem(
  tripId: string,
  item: PlanItem,
  now: Date = new Date(),
): Promise<void> {
  const removed = markRemoved(item, now);
  await saveAll(tripId, [removed]);
  logActivity(
    tripId,
    {
      kind: "removed",
      targetId: item.id,
      summary: t("activity.removedFrom", {
        name: placeName(item.placeId),
        day: formatDayLabel(item.date),
      }),
      before: item,
      after: removed,
    },
    now,
  );
}

// Puts an item back as it was before a change (used by Undo).
export async function restoreItem(
  tripId: string,
  previous: PlanItem,
  now: Date = new Date(),
): Promise<void> {
  const restored = { ...previous, updatedAt: now.toISOString() };
  await saveAll(tripId, [restored]);
  logActivity(
    tripId,
    {
      kind: "restored",
      targetId: previous.id,
      summary: t("activity.restoredOn", {
        name: placeName(previous.placeId),
        day: formatDayLabel(previous.date),
      }),
      after: restored,
    },
    now,
  );
}

// Undoes a plan change from the activity log, if the stop hasn't changed
// since. Returns false when it can't be undone.
export async function undoActivity(
  tripId: string,
  entry: Activity,
  current: PlanItem | undefined,
  now: Date = new Date(),
): Promise<boolean> {
  const target = undoFor(entry, current, now);
  if (!target) return false;
  await saveAll(tripId, [target]);
  logActivity(
    tripId,
    {
      kind: "undone",
      targetId: target.id,
      summary: t("activity.undid", { summary: entry.summary }),
      before: current,
      after: target,
    },
    now,
  );
  return true;
}
