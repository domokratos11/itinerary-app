"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Info,
  SkipForward,
  Trash2,
} from "lucide-react";

import { LogCostButton, placePrefill } from "@/components/expense-form";
import { CategoryBadge, PriorityBadge } from "@/components/tag-badges";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { stopColor } from "@/domain/map-pins";
import { isDraft } from "@/domain/place-edit";
import { holidayWarnings, stopWarnings } from "@/domain/plan";
import type { PlanItem, Place } from "@/domain/schemas";
import { t } from "@/lib/i18n";
import { useTrip } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";
import { cn } from "@/lib/utils";

// One stop of the day plan: a station on the day's line. Closed, it is one
// row (number, name, tags); opened, it shows its status buttons and actions.
// The next stop opens by itself, as that is the one to act on.

// A row of the line: the rail runs down the left in the city's colour
// (--day-line, set on the list) and the stop's number sits on it.
export const LINE_ITEM =
  "relative flex flex-col gap-2 pb-3 pl-9 before:absolute before:inset-y-0 before:left-[12.5px] before:w-[3px] before:bg-(--day-line) first:before:top-3 first:before:rounded-t-full last:before:rounded-b-full";

export type StopOutcome = "done" | "skipped";

type StopProps = {
  // Its place in the day, the same number as its pin on the map.
  number: number;
  item: PlanItem;
  place: Place | undefined;
  dayOptions: { date: string; label: string }[];
  currentDate: string;
  onRemove: () => void;
  onMark: (status: StopOutcome) => void;
  onMoveDay: (date: string) => void;
  onOpenPlace: () => void;
  // The first stop still planned: it starts opened and is marked "Next".
  isNext: boolean;
  // On a read-only link: the stop and its map link, nothing to change.
  readOnly: boolean;
};

// Wide screens: drag the grip to reorder, or focus it and use Space and the
// arrow keys.
export function SortableStop({
  id,
  leg,
  ...props
}: StopProps & { id: string; leg: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className={LINE_ITEM}>
      {leg}
      <StopCard
        {...props}
        handle={
          props.readOnly ? undefined : (
            <Tip label={t("day.dragToReorder")}>
              <button
                type="button"
                aria-label={t("day.dragToReorder")}
                className="mt-0.5 cursor-grab touch-none rounded-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                <GripVertical />
              </button>
            </Tip>
          )
        }
      />
    </li>
  );
}

// Phones use the up/down buttons instead of dragging.
export function StopCard({
  number,
  item,
  place,
  dayOptions,
  currentDate,
  onRemove,
  onMark,
  onMoveDay,
  onOpenPlace,
  isNext,
  readOnly,
  handle,
  buttons,
}: StopProps & {
  handle?: ReactNode;
  buttons?: {
    canUp: boolean;
    canDown: boolean;
    onUp: () => void;
    onDown: () => void;
  };
}) {
  const { holidays } = useTrip();
  const memberTripId = useTripId();
  const tripId = readOnly ? null : memberTripId;
  const name = place?.name ?? item.placeId;
  const finished = item.status === "done" || item.status === "skipped";
  // Opened or closed by hand wins; otherwise only the next stop is open. A
  // read-only link has nothing to hide, only the map link.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const expanded = readOnly || (chosen ?? isNext);
  const actionsId = useId();
  const warnings = place
    ? [
        ...stopWarnings(place, item.date, t),
        ...holidayWarnings(place, item.date, holidays, t),
      ]
    : [];

  return (
    <div className="relative">
      <span
        aria-hidden
        className="absolute top-1.5 -left-9 flex size-7 items-center justify-center rounded-full font-heading text-sm font-semibold text-white tabular-nums ring-2 ring-background"
        style={{ backgroundColor: stopColor(item.status) }}
      >
        {number}
      </span>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl",
          expanded ? "bg-card p-3 shadow-sm ring-1 ring-border" : "py-1.5",
          finished && "opacity-70",
        )}
      >
        <div className="flex items-start gap-2">
          {handle}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div
              className={cn(
                "text-base leading-snug font-semibold",
                item.status === "done" && "line-through",
              )}
            >
              {place ? (
                <button
                  type="button"
                  aria-label={t("day.openDetails", { name })}
                  onClick={onOpenPlace}
                  className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {name}
                  <Info
                    aria-hidden
                    className="ml-1.5 inline size-4 align-[-0.125em] text-muted-foreground"
                  />
                </button>
              ) : (
                name
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isNext && (
                <Badge className="bg-now text-now-foreground">
                  {t("home.nextStop")}
                </Badge>
              )}
              {place && (
                <>
                  <CategoryBadge category={place.category} />
                  <PriorityBadge priority={place.priority} />
                </>
              )}
              {finished && (
                <Badge
                  variant="secondary"
                  className={cn(
                    item.status === "done" && "bg-success/15 text-success",
                  )}
                >
                  {item.status === "done"
                    ? t("common.done")
                    : t("common.skipped")}
                </Badge>
              )}
              {place && isDraft(place) && (
                <Badge variant="outline" className="border-dashed">
                  {t("common.notResearched")}
                </Badge>
              )}
              {!finished &&
                warnings.map((warning) => (
                  <Badge key={warning} variant="destructive">
                    {warning}
                  </Badge>
                ))}
            </div>
          </div>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-expanded={expanded}
              aria-controls={actionsId}
              aria-label={
                expanded
                  ? t("day.hideActions", { name })
                  : t("day.showActions", { name })
              }
              className="-my-1 shrink-0 text-muted-foreground"
              onClick={() => setChosen(!expanded)}
            >
              <ChevronDown
                className={cn("transition-transform", expanded && "rotate-180")}
              />
            </Button>
          )}
        </div>
        {expanded && (
          <div id={actionsId} className="flex flex-wrap items-center gap-2">
            {!readOnly && (
              <>
                <Button
                  variant={item.status === "done" ? "default" : "outline"}
                  aria-pressed={item.status === "done"}
                  aria-label={t("day.wentName", { name })}
                  className="flex-1 sm:flex-none"
                  onClick={() => onMark("done")}
                >
                  <Check />
                  {t("day.went")}
                </Button>
                <Button
                  variant={item.status === "skipped" ? "default" : "outline"}
                  aria-pressed={item.status === "skipped"}
                  aria-label={t("day.skipName", { name })}
                  className="flex-1 sm:flex-none"
                  onClick={() => onMark("skipped")}
                >
                  <SkipForward />
                  {t("day.skip")}
                </Button>
                {/* On phones: these two on top, the small actions, then the day. */}
                <span aria-hidden className="basis-full sm:hidden" />
              </>
            )}
            {place && (
              <Tip label={t("place.tipOpenInMaps")}>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={place.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    {t("common.map")}
                  </a>
                </Button>
              </Tip>
            )}
            {buttons && !readOnly && (
              <>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("day.moveUp")}
                  disabled={!buttons.canUp}
                  onClick={buttons.onUp}
                >
                  <ChevronUp />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("day.moveDown")}
                  disabled={!buttons.canDown}
                  onClick={buttons.onDown}
                >
                  <ChevronDown />
                </Button>
              </>
            )}
            {dayOptions.length > 1 && !readOnly && (
              <Select value={currentDate} onValueChange={onMoveDay}>
                <SelectTrigger
                  size="sm"
                  className="order-last w-full sm:order-none sm:w-44"
                >
                  <SelectValue placeholder={t("common.moveTo")} />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((d) => (
                    <SelectItem key={d.date} value={d.date}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {place && tripId && (
              <LogCostButton
                tripId={tripId}
                prefill={{ ...placePrefill(place), date: item.date }}
                className="ml-auto"
              />
            )}
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("day.remove")}
                className={cn(!(place && tripId) && "ml-auto")}
                onClick={onRemove}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
