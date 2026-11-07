"use client";

import { useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";

import { LIST_ID, parseDragId } from "@/components/day-side-panel";
import type { StopOutcome } from "@/components/day-plan-stop";
import { planDrop, type DragSource, type DropTarget } from "@/domain/drop";
import { itemsForDay } from "@/domain/plan";
import type { City, Place, PlanItem } from "@/domain/schemas";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import {
  addPlaceAt,
  placeItem,
  removeItem,
  restoreItem,
  updateItem,
} from "@/lib/plan-actions";
import type { useTripDays } from "@/lib/trip-store";

type Options = {
  // Null on a read-only link: every action then does nothing.
  tripId: string | null;
  date: string;
  items: PlanItem[];
  stops: PlanItem[];
  placesById: Map<string, Place>;
  citiesById: Map<string, City>;
  tripDays: ReturnType<typeof useTripDays>;
};

// What the day plan can do to its stops: drag and drop on wide screens,
// the step buttons on phones, marking, moving and removing, each with its
// toast and Undo.
export function useDayPlanActions({
  tripId,
  date,
  items,
  stops,
  placesById,
  citiesById,
  tripDays,
}: Options) {
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Every write goes through plan-actions and PlanRepository. Saves are not
  // awaited: the local cache applies them at once and only a refusal is shown.
  function move(
    item: PlanItem,
    date: string,
    index: number,
    others: PlanItem[],
  ) {
    if (!tripId) return;
    placeItem(tripId, item, date, index, others).catch(() =>
      toast.error(t("common.refused")),
    );
  }

  function sourceFor(id: string): DragSource | null {
    const parsed = parseDragId(id);
    if (parsed?.kind === "place") {
      const place = placesById.get(parsed.value);
      return place
        ? { kind: "place", placeId: place.id, cityId: place.cityId }
        : null;
    }
    const item = stops.find((i) => i.id === id);
    return item
      ? {
          kind: "stop",
          item,
          cityId: placesById.get(item.placeId)?.cityId ?? null,
        }
      : null;
  }

  function targetFor(id: string): DropTarget | null {
    if (id === LIST_ID) return { kind: "list" };
    const parsed = parseDragId(id);
    if (parsed?.kind === "day") return { kind: "day", date: parsed.value };
    const index = stops.findIndex((i) => i.id === id);
    return index < 0 ? null : { kind: "stop", index };
  }

  function nameOf(source: DragSource): string {
    if (source.kind === "stop")
      return placesById.get(source.item.placeId)?.name ?? t("day.thisStop");
    return placesById.get(source.placeId)?.name ?? t("day.thisPlace");
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    if (!over || !tripId) return;
    const source = sourceFor(String(active.id));
    const target = targetFor(String(over.id));
    if (!source || !target) return;
    const movingId = source.kind === "stop" ? source.item.id : null;
    const dayItems = (date: string) =>
      itemsForDay(items, date).filter((i) => i.id !== movingId);
    const plan = planDrop(source, target, {
      date: date,
      stops,
      days: tripDays,
      dayLength: (date) => dayItems(date).length,
    });
    if (plan.kind === "none") return;
    if (plan.kind === "refuse") {
      const city =
        citiesById.get(source.cityId ?? "")?.name ?? t("day.itsCity");
      toast.error(
        plan.reason === "not-a-day"
          ? t("day.notATripDayDrop")
          : t("day.cityNotOnDay", {
              city,
              day: formatDayLabel(plan.date),
              name: nameOf(source),
            }),
      );
      return;
    }

    const id = tripId;
    const label = formatDayLabel(plan.date);
    if (source.kind === "stop") {
      const before = source.item;
      move(before, plan.date, plan.index, dayItems(plan.date));
      if (plan.date !== before.date)
        toast(t("day.moved", { name: nameOf(source), day: label }), {
          action: {
            label: t("common.undo"),
            onClick: () => undo(restoreItem(id, before)),
          },
        });
      return;
    }

    addToDay(source.placeId, plan.date, plan.index, dayItems(plan.date));
  }

  function addToDay(
    placeId: string,
    date: string,
    index: number,
    dayItems: PlanItem[],
  ) {
    if (!tripId) return;
    const id = tripId;
    const name = placesById.get(placeId)?.name ?? t("day.thisPlace");
    addPlaceAt(id, placeId, date, index, dayItems)
      .then((stop) =>
        toast(t("common.addedToDay", { name, day: formatDayLabel(date) }), {
          action: {
            label: t("common.undo"),
            onClick: () => undo(removeItem(id, stop)),
          },
        }),
      )
      .catch(() => toast.error(t("common.refused")));
  }

  function undo(write: Promise<void>) {
    write.catch(() => toast.error(t("common.undoFailed")));
  }

  function stepBy(item: PlanItem, delta: number) {
    const index = stops.findIndex((i) => i.id === item.id);
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    move(
      item,
      date,
      target,
      stops.filter((i) => i.id !== item.id),
    );
  }

  function moveToDay(item: PlanItem, date: string) {
    if (date === item.date) return;
    const dayItems = itemsForDay(items, date);
    move(item, date, dayItems.length, dayItems);
  }

  function remove(item: PlanItem) {
    if (!tripId) return;
    const id = tripId;
    removeItem(id, item).catch(() => toast.error(t("common.refused")));
    toast(t("day.removed"), {
      action: {
        label: t("common.undo"),
        onClick: () => {
          restoreItem(id, item).catch(() =>
            toast.error(t("common.undoFailed")),
          );
        },
      },
    });
  }

  // Tapping the status a stop already has takes it back to planned.
  function mark(item: PlanItem, status: StopOutcome) {
    if (!tripId) return;
    updateItem(tripId, item, {
      status: item.status === status ? "planned" : status,
    }).catch(() => toast.error(t("common.refused")));
  }

  return {
    sensors,
    dragging,
    setDragging,
    handleDragEnd,
    addToDay,
    stepBy,
    moveToDay,
    remove,
    mark,
  };
}
