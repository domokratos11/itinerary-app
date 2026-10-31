"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripDay } from "@/domain/days";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDayLabel } from "@/lib/format-day";

// Drag ids on the day page. Stops use their plan item id; everything else
// carries a prefix so the drop handler can tell them apart.
export const LIST_ID = "list";
export const queueDragId = (id: string) => `queue:${id}`;
export const placeDragId = (id: string) => `place:${id}`;
export const dayDropId = (date: string) => `day:${date}`;

export function parseDragId(
  id: string,
): { kind: "queue" | "place" | "day"; value: string } | null {
  const match = id.match(/^(queue|place|day):(.+)$/);
  return match
    ? { kind: match[1] as "queue" | "place" | "day", value: match[2] }
    : null;
}

export type Waiting = {
  dragId: string;
  name: string;
  detail: string;
};

// Wide screens only: things waiting to be placed (drag them into the day)
// and the other days of this city (drop a stop on one to move it there).
export function DaySidePanel({
  waiting,
  otherDays,
  stopCounts,
}: {
  waiting: Waiting[];
  otherDays: TripDay[];
  stopCounts: Map<string, number>;
}) {
  return (
    <aside className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("day.waiting")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {waiting.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("day.waitingNone")}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t("day.waitingDrag")}
              </p>
              <ul className="flex flex-col gap-2">
                {waiting.map((w) => (
                  <WaitingItem key={w.dragId} waiting={w} />
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {otherDays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("day.moveToAnother")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {t("day.moveToAnotherHint")}
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
          </CardContent>
        </Card>
      )}
    </aside>
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
      aria-label={t("day.dragInto", { name: waiting.name })}
    >
      <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{waiting.name}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {waiting.dragId.startsWith("queue:") && <Link2 className="size-3" />}
          {waiting.detail}
        </span>
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
