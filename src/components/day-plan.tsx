"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Navigation,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { deriveDays } from "@/domain/days";
import {
  directionsUrl,
  distanceBetweenPlaces,
  itemsForDay,
  legsForDay,
  nextStop,
  placeLocation,
  stopWarnings,
  type Location,
} from "@/domain/plan";
import type { PlanItem, Place, Reservation } from "@/domain/schemas";
import { allPlaces, trip } from "@/lib/catalog";
import { CATEGORY_LABEL } from "@/lib/category-label";
import { CostLine } from "@/components/cost-line";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDayLabel } from "@/lib/format-day";
import { placeItem, removeItem, restoreItem } from "@/lib/plan-actions";
import { usePlanStore } from "@/lib/plan-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { useTripId } from "@/lib/use-trip-id";

export type Endpoint = { name: string; location: Location | null };

type Props = {
  date: string;
  label: string;
  cityNames: string[];
  cityIds: string[];
  start: Endpoint | null;
  end: Endpoint | null;
  reservations: Reservation[];
};

const placesById = new Map(allPlaces.map((p) => [p.id, p]));
const tripDays = deriveDays(trip.stays);

const REFUSED = "That change was refused. Check the trip link.";

type Origin = { location: Location | null; place: Place | null };

export function DayPlan(props: Props) {
  const tripId = useTripId();
  const items = usePlanStore((s) => s.items);
  const wide = useMediaQuery("(min-width: 768px)");
  const stops = useMemo(
    () => itemsForDay(items, props.date),
    [items, props.date],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
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
    if (!tripId) return toast.error("Open your shared link with ?trip= first.");
    placeItem(tripId, item, date, index, others).catch(() =>
      toast.error(REFUSED),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = stops.findIndex((i) => i.id === active.id);
    const to = stops.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    const item = stops[from];
    // `to` is the item's new position in the list. Without the moved item,
    // the same index is the right slot.
    move(
      item,
      props.date,
      to,
      stops.filter((i) => i.id !== item.id),
    );
  }

  function stepBy(item: PlanItem, delta: number) {
    const index = stops.findIndex((i) => i.id === item.id);
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    move(
      item,
      props.date,
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
    if (!tripId) return toast.error("Open your shared link with ?trip= first.");
    const id = tripId;
    removeItem(id, item).catch(() => toast.error(REFUSED));
    toast("Removed from the plan", {
      action: {
        label: "Undo",
        onClick: () => {
          restoreItem(id, item).catch(() =>
            toast.error("Couldn't undo that change."),
          );
        },
      },
    });
  }

  // Origin for a stop's directions: the stop before it, or the start hotel.
  function originFor(index: number): Origin {
    if (index === 0)
      return { location: props.start?.location ?? null, place: null };
    const prev = placesById.get(stops[index - 1].placeId) ?? null;
    return { location: prev ? placeLocation(prev) : null, place: prev };
  }

  const next = nextStop(stops);
  const nextPlace = next ? placesById.get(next.placeId) : undefined;

  function dayOptionsFor(cityId: string | undefined) {
    if (!cityId) return [];
    return tripDays
      .filter((d) => d.cityIds.includes(cityId))
      .map((d) => ({ date: d.date, label: formatDayLabel(d.date) }));
  }

  const rows = stops.map((item) => ({
    item,
    place: placesById.get(item.placeId),
  }));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={tripId ? `/?trip=${tripId}` : "/"}
            className="text-sm text-muted-foreground underline"
          >
            ← Trip days
          </Link>
          <div className="flex items-center gap-2">
            <RecentlyChanged />
            <ThemeToggle />
          </div>
        </div>
        <h1 className="text-2xl font-semibold">{props.label}</h1>
        <CostLine places={stops.map((i) => placesById.get(i.placeId))} />
        <div className="flex flex-wrap gap-2">
          {props.cityNames.map((name) => (
            <Badge key={name} variant="secondary">
              {name}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {nextPlace ? (
            <Button asChild size="sm">
              <a
                href={directionsUrl(placeLocation(nextPlace))}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation />
                Go to next stop
              </a>
            </Button>
          ) : (
            <Button size="sm" disabled>
              No planned stops left
            </Button>
          )}
          <FullDay start={props.start} end={props.end} stops={stops} />
        </div>
      </header>

      {props.start && <HotelRow label="Start" endpoint={props.start} />}

      {wide ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rows.map((r) => r.item.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col gap-3">
              {rows.map((row, index) => (
                <SortableStop
                  key={row.item.id}
                  id={row.item.id}
                  item={row.item}
                  place={row.place}
                  origin={originFor(index)}
                  dayOptions={dayOptionsFor(row.place?.cityId)}
                  currentDate={props.date}
                  onRemove={() => remove(row.item)}
                  onMoveDay={(d) => moveToDay(row.item, d)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={row.item.id}>
              <StopCard
                item={row.item}
                place={row.place}
                origin={originFor(index)}
                dayOptions={dayOptionsFor(row.place?.cityId)}
                currentDate={props.date}
                onRemove={() => remove(row.item)}
                onMoveDay={(d) => moveToDay(row.item, d)}
                buttons={{
                  canUp: index > 0,
                  canDown: index < rows.length - 1,
                  onUp: () => stepBy(row.item, -1),
                  onDown: () => stepBy(row.item, 1),
                }}
              />
            </li>
          ))}
        </ol>
      )}

      {stops.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No stops yet. Open a place from a city list and choose Add to day.
        </p>
      )}

      {props.end && <HotelRow label="End" endpoint={props.end} />}

      {props.reservations.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase">
            Reservations
          </h2>
          {props.reservations.map((r, i) => (
            <Card key={`${r.type}-${i}`}>
              <CardContent className="flex flex-col gap-1 py-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.type}</Badge>
                  {r.time && <span className="font-medium">{r.time}</span>}
                </div>
                <div>
                  {r.from && r.to
                    ? `${r.from} → ${r.to}`
                    : (r.from ?? r.to ?? "")}
                </div>
                {r.note && (
                  <div className="text-muted-foreground">{r.note}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

function HotelRow({ label, endpoint }: { label: string; endpoint: Endpoint }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground uppercase">
            {label} · Hotel
          </span>
          <span className="font-medium">{endpoint.name}</span>
        </div>
        {endpoint.location && (
          <Button asChild variant="outline" size="sm">
            <a
              href={directionsUrl(endpoint.location)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

type StopProps = {
  item: PlanItem;
  place: Place | undefined;
  origin: Origin;
  dayOptions: { date: string; label: string }[];
  currentDate: string;
  onRemove: () => void;
  onMoveDay: (date: string) => void;
};

// Wide screens: drag the grip to reorder.
function SortableStop({ id, ...props }: StopProps & { id: string }) {
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
    <li ref={setNodeRef} style={style}>
      <StopCard
        {...props}
        handle={
          <button
            type="button"
            aria-label="Drag to reorder"
            className="cursor-grab touch-none text-muted-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical />
          </button>
        }
      />
    </li>
  );
}

// Phones use the up/down buttons instead of dragging.
function StopCard({
  item,
  place,
  origin,
  dayOptions,
  currentDate,
  onRemove,
  onMoveDay,
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
  const name = place?.name ?? item.placeId;
  const distance =
    place && origin.place ? distanceBetweenPlaces(origin.place, place) : null;
  const directions = place
    ? directionsUrl(placeLocation(place), origin.location ?? undefined)
    : null;
  const meta = [
    item.startTime,
    item.durationMin ? `${item.durationMin} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        {handle}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle className="text-base">{name}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {place && (
              <Badge variant="secondary">
                {CATEGORY_LABEL[place.category]}
              </Badge>
            )}
            {meta && <Badge variant="outline">{meta}</Badge>}
            {place &&
              stopWarnings(place, item.date).map((warning) => (
                <Badge key={warning} variant="destructive">
                  {warning}
                </Badge>
              ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {item.note && <p className="text-sm">{item.note}</p>}
        {directions && (
          <div className="text-sm text-muted-foreground">
            {distance !== null && <span>{distance.toFixed(1)} km away · </span>}
            <a
              className="underline"
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions{origin.place ? ` from ${origin.place.name}` : ""}
            </a>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {place && (
            <Button asChild variant="outline" size="sm">
              <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Map
              </a>
            </Button>
          )}
          {buttons && (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Move up"
                disabled={!buttons.canUp}
                onClick={buttons.onUp}
              >
                <ChevronUp />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Move down"
                disabled={!buttons.canDown}
                onClick={buttons.onDown}
              >
                <ChevronDown />
              </Button>
            </>
          )}
          {dayOptions.length > 1 && (
            <Select value={currentDate} onValueChange={onMoveDay}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="Move to…" />
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove"
            className="ml-auto"
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FullDay({
  start,
  end,
  stops,
}: {
  start: Endpoint | null;
  end: Endpoint | null;
  stops: PlanItem[];
}) {
  const legs = useMemo(() => {
    if (!start?.location || !end?.location) return null;
    const points = stops.flatMap((item) => {
      const place = placesById.get(item.placeId);
      return place
        ? [{ name: place.name, location: placeLocation(place) }]
        : [];
    });
    return legsForDay({ name: start.name, location: start.location }, points, {
      name: end.name,
      location: end.location,
    });
  }, [start, end, stops]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Full day
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Full day</SheetTitle>
          <SheetDescription>Every leg, one tap each.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-6">
          {legs === null && (
            <p className="text-sm text-muted-foreground">
              This day needs a hotel with a location before the full route can
              be built.
            </p>
          )}
          {legs?.length === 0 && (
            <p className="text-sm text-muted-foreground">No stops yet.</p>
          )}
          {legs?.map((leg) => (
            <a
              key={`${leg.from}-${leg.to}`}
              href={leg.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <span>
                {leg.from} → {leg.to}
              </span>
              <ExternalLink className="size-4 text-muted-foreground" />
            </a>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Every item in the trip, newest change first. Removed stops can be restored.
function RecentlyChanged() {
  const items = usePlanStore((s) => s.items);
  const tripId = useTripId();
  const recent = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
      ),
    [items],
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Recently changed
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Recently changed</SheetTitle>
          <SheetDescription>
            Newest first. Removed stops can be restored.
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-2 px-4 pb-6">
          {recent.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate">
                  {placesById.get(item.placeId)?.name ?? item.placeId}
                </span>
                <span className="text-muted-foreground">
                  {formatDayLabel(item.date)} · {item.status}
                </span>
              </span>
              {item.status === "removed" && tripId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    restoreItem(tripId, {
                      ...item,
                      status: "planned",
                      updatedAt: new Date().toISOString(),
                    }).catch(() => toast.error(REFUSED))
                  }
                >
                  Restore
                </Button>
              )}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
