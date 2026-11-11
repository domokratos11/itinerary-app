"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical, ListFilter, MapPin, MapPinOff, X } from "lucide-react";

import {
  CategoryBadge,
  CategoryOption,
  PriorityBadge,
  PriorityOption,
} from "@/components/tag-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isDraft } from "@/domain/place-edit";
import { CATEGORIES, PRIORITIES, type Place } from "@/domain/schemas";
import type { TripDay } from "@/domain/days";
import {
  DEFAULT_WAITING_VIEW,
  isDefaultWaitingView,
  WAITING_SORTS,
  type WaitingSort,
  type WaitingView,
} from "@/domain/waiting-view";
import type { MessageKey } from "@/domain/i18n";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDayLabel } from "@/lib/format-day";
import { dayHref } from "@/lib/links";

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
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border bg-muted/30">
      <h2 className="px-3 pt-3 pb-2 text-sm font-medium">{title}</h2>
      {actions && <div className="px-3 pb-2">{actions}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>
    </section>
  );
}

const SORT_LABEL: Record<WaitingSort, MessageKey> = {
  priority: "day.sortPriority",
  "name-asc": "day.sortNameAsc",
  "name-desc": "day.sortNameDesc",
};

// Why the list is empty, or what to do with what's in it. `total` is how many
// are waiting before any filter.
export function waitingHint(shown: number, total: number, hint: string) {
  if (total === 0) return t("day.waitingNone");
  return shown === 0 ? t("day.waitingNoMatches") : hint;
}

export type WaitingControlsProps = {
  view: WaitingView;
  onViewChange: (view: WaitingView) => void;
  shown: number;
  total: number;
  onMap: boolean;
  onMapChange: (onMap: boolean) => void;
};

// Helps choose what to place: their pins on the map, in any order and filter.
// Pins are off until asked for, and follow the filters when they're on.
export function WaitingControls({
  view,
  onViewChange,
  shown,
  total,
  onMap,
  onMapChange,
}: WaitingControlsProps) {
  const filtered = !isDefaultWaitingView(view);
  // Choosing keeps the menu open, as several choices are often made together.
  const stayOpen = (event: Event) => event.preventDefault();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant={onMap ? "default" : "outline"}
          size="sm"
          aria-pressed={onMap}
          disabled={total === 0}
          onClick={() => onMapChange(!onMap)}
        >
          {onMap ? <MapPinOff /> : <MapPin />}
          {onMap ? t("day.hideFromMap") : t("day.showOnMap")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={filtered ? "secondary" : "outline"}
              size="sm"
              disabled={total === 0}
            >
              <ListFilter />
              {t("day.sortAndFilter")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            collisionPadding={8}
            className="w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("day.sortBy")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={view.sort}
                onValueChange={(sort) =>
                  onViewChange({ ...view, sort: sort as WaitingSort })
                }
              >
                {WAITING_SORTS.map((sort) => (
                  <DropdownMenuRadioItem
                    key={sort}
                    value={sort}
                    onSelect={stayOpen}
                  >
                    {t(SORT_LABEL[sort])}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("common.priority")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={view.priority}
                onValueChange={(priority) =>
                  onViewChange({
                    ...view,
                    priority: priority as WaitingView["priority"],
                  })
                }
              >
                <DropdownMenuRadioItem value="all" onSelect={stayOpen}>
                  {t("cities.allPriorities")}
                </DropdownMenuRadioItem>
                {PRIORITIES.map((priority) => (
                  <DropdownMenuRadioItem
                    key={priority}
                    value={priority}
                    onSelect={stayOpen}
                  >
                    <PriorityOption priority={priority} />
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("common.category")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={view.category}
                onValueChange={(category) =>
                  onViewChange({
                    ...view,
                    category: category as WaitingView["category"],
                  })
                }
              >
                <DropdownMenuRadioItem value="all" onSelect={stayOpen}>
                  {t("day.allCategories")}
                </DropdownMenuRadioItem>
                {CATEGORIES.map((category) => (
                  <DropdownMenuRadioItem
                    key={category}
                    value={category}
                    onSelect={stayOpen}
                  >
                    <CategoryOption category={category} />
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewChange(DEFAULT_WAITING_VIEW)}
          >
            <X />
            {t("day.clearFilters")}
          </Button>
        )}
      </div>
      {filtered && (
        <p className="text-xs text-muted-foreground">
          {t("cities.placesShown", { shown, total })}
        </p>
      )}
    </div>
  );
}

// Things waiting to be placed: drag them into the day. On a read-only link
// they can only be opened.
export function WaitingColumn({
  waiting,
  total,
  controls,
  onOpen,
}: {
  waiting: Waiting[];
  total: number;
  controls: ReactNode;
  onOpen?: (placeId: string) => void;
}) {
  return (
    <DayColumn title={t("day.waiting")} actions={controls}>
      <p className="pb-2 text-xs text-muted-foreground">
        {waitingHint(
          waiting.length,
          total,
          onOpen ? t("share.waitingHint") : t("day.waitingDrag"),
        )}
      </p>
      <ul className="flex flex-col gap-2">
        {waiting.map((w) =>
          onOpen ? (
            <li key={w.dragId}>
              <button
                type="button"
                onClick={() => onOpen(w.place.id)}
                className="flex w-full flex-col gap-1 rounded-md border bg-card p-2 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="truncate font-medium">{w.place.name}</span>
                <WaitingTags place={w.place} />
              </button>
            </li>
          ) : (
            <WaitingItem key={w.dragId} waiting={w} />
          ),
        )}
      </ul>
    </DayColumn>
  );
}

// The other days of this city: drop a stop on one to move it there. On a
// read-only link they are links to those days instead.
export function OtherDaysColumn({
  otherDays,
  stopCounts,
  readOnly = false,
}: {
  otherDays: TripDay[];
  stopCounts: Map<string, number>;
  readOnly?: boolean;
}) {
  return (
    <DayColumn title={readOnly ? t("share.otherDays") : t("day.moveToAnother")}>
      <p className="pb-2 text-xs text-muted-foreground">
        {otherDays.length === 0
          ? t("day.noOtherDays")
          : readOnly
            ? t("share.otherDaysHint")
            : t("day.moveToAnotherHint")}
      </p>
      <ul className="flex flex-col gap-1">
        {otherDays.map((d) =>
          readOnly ? (
            <li key={d.date}>
              <Link
                href={dayHref(d.date, null)}
                className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs hover:bg-accent"
              >
                {formatDayLabel(d.date)}
                <Badge variant="outline">{stopCounts.get(d.date) ?? 0}</Badge>
              </Link>
            </li>
          ) : (
            <DayDrop
              key={d.date}
              date={d.date}
              stops={stopCounts.get(d.date) ?? 0}
            />
          ),
        )}
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
        "flex items-center justify-between gap-2 rounded-md border border-dashed px-2 py-1 text-xs transition-colors",
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
