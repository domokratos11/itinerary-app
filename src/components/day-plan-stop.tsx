"use client";

import type { CSSProperties, ReactNode } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// One stop of the day plan: a card with its status buttons and actions.

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
    <li ref={setNodeRef} style={style} className="flex flex-col gap-3">
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
  const warnings = place
    ? [
        ...stopWarnings(place, item.date, t),
        ...holidayWarnings(place, item.date, holidays, t),
      ]
    : [];

  return (
    <Card size="sm" className={cn(finished && "opacity-70")}>
      <CardHeader className="flex items-start gap-3">
        {handle}
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white tabular-nums"
          style={{ backgroundColor: stopColor(item.status) }}
        >
          {number}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle
            className={cn(
              "text-base",
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
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {place && (
              <>
                <CategoryBadge category={place.category} />
                <PriorityBadge priority={place.priority} />
              </>
            )}
            {finished && (
              <Badge>
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
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <Button
                variant={item.status === "done" ? "default" : "outline"}
                size="sm"
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
                size="sm"
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
      </CardContent>
    </Card>
  );
}
