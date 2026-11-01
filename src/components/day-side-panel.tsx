"use client";

import type { ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";

import { CategoryBadge, PriorityBadge } from "@/components/tag-badges";
import { Badge } from "@/components/ui/badge";
import { isDraft } from "@/domain/place-edit";
import type { Place } from "@/domain/schemas";
import type { TripDay } from "@/domain/days";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDayLabel } from "@/lib/format-day";

// Drag ids on the day page. Stops use their plan item id; everything else
// carries a prefix so the drop handler can tell them apart.
export const LIST_ID = "list";
export const placeDragId = (id: string) => `place:${id}`;
export const dayDropId = (date: string) => `day:${date}`;

export function parseDragId(
  id: string,
): { kind: "place" | "day"; value: string } | null {
  const match = id.match(/^(place|day):(.+)$/);
  return match ? { kind: match[1] as "place" | "day", value: match[2] } : null;
}

export type Waiting = {
  dragId: string;
  place: Place;
};

// What tells one waiting place from another at a glance.
export function WaitingTags({ place }: { place: Place }) {
  return (
    <span className="flex flex-wrap gap-1">
      <CategoryBadge category={place.category} />
      <PriorityBadge priority={place.priority} />
      {isDraft(place) && (
        <Badge variant="outline" className="border-dashed">
          {t("common.notResearched")}
        </Badge>
      )}
    </span>
  );
}

// One column of the day page on wide screens: its title stays put and the
// rest scrolls, so a long list never pushes the map away.
export function DayColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border bg-muted/30">
      <h2 className="px-3 pt-3 pb-2 text-sm font-medium">{title}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>
    </section>
  );
}

// Things waiting to be placed: drag them into the day.
export function WaitingColumn({ waiting }: { waiting: Waiting[] }) {
  return (
    <DayColumn title={t("day.waiting")}>
      <p className="pb-2 text-xs text-muted-foreground">
        {waiting.length === 0 ? t("day.waitingNone") : t("day.waitingDrag")}
      </p>
      <ul className="flex flex-col gap-2">
        {waiting.map((w) => (
          <WaitingItem key={w.dragId} waiting={w} />
        ))}
      </ul>
    </DayColumn>
  );
}

// The other days of this city: drop a stop on one to move it there.
export function OtherDaysColumn({
  otherDays,
  stopCounts,
}: {
  otherDays: TripDay[];
  stopCounts: Map<string, number>;
}) {
  return (
    <DayColumn title={t("day.moveToAnother")}>
      <p className="pb-2 text-xs text-muted-foreground">
        {otherDays.length === 0
          ? t("day.noOtherDays")
          : t("day.moveToAnotherHint")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {otherDays.map((d) => (
          <DayDrop
            key={d.date}
            date={d.date}
            stops={stopCounts.get(d.date) ?? 0}
          />
        ))}
      </ul>
    </DayColumn>
  );
}

function WaitingItem({ waiting }: { waiting: Waiting }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: waiting.dragId,
  });
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex cursor-grab touch-none items-start gap-2 rounded-md border bg-card p-2 text-sm active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      aria-label={t("day.dragInto", { name: waiting.place.name })}
    >
      <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium">{waiting.place.name}</span>
        <WaitingTags place={waiting.place} />
      </span>
    </li>
  );
}

function DayDrop({ date, stops }: { date: string; stops: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(date) });
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm transition-colors",
        isOver && "border-primary bg-primary/10",
      )}
    >
      {formatDayLabel(date)}
      <Badge variant="outline">{stops}</Badge>
    </li>
  );
}

// The day's list as a drop target, so a place can be dropped at the end or
// into an empty day.
export function useListDrop() {
  return useDroppable({ id: LIST_ID });
}

// What follows the pointer while dragging from the side panel.
export function DragPreview({ name }: { name: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-lg">
      {name}
    </div>
  );
}
