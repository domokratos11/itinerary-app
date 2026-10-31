"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
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
  Pencil,
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
import {
  directionsUrl,
  holidayWarnings,
  itemsForDay,
  legsForDay,
  dayRunsLate,
  nextStop,
  placeLocation,
  stopTimes,
  stopWarnings,
  timeWarnings,
} from "@/domain/plan";
import type { PlanItem, Place, Reservation } from "@/domain/schemas";
import type { Endpoint } from "@/domain/trip";
import { planDrop, type DragSource, type DropTarget } from "@/domain/drop";
import { isDraft, suggestCity } from "@/domain/queue";
import {
  DaySidePanel,
  DragPreview,
  LIST_ID,
  parseDragId,
  placeDragId,
  queueDragId,
  useListDrop,
} from "@/components/day-side-panel";
import { t } from "@/lib/i18n";
import { categoryLabel } from "@/lib/category-label";
import { CostLine } from "@/components/cost-line";
import { formatDayLabel } from "@/lib/format-day";
import {
  addPlaceAt,
  placeItem,
  removeItem,
  restoreItem,
  updateItem,
} from "@/lib/plan-actions";
import { PlaceDetails } from "@/components/place-details";
import { StopEditor, type StopChanges } from "@/components/stop-editor";
import { LegLine } from "@/components/leg-line";
import { TripMap } from "@/components/trip-map";
import { dayLegs } from "@/domain/legs";
import { dayMap } from "@/domain/map-pins";
import type { MapLine } from "@/domain/maps-service";
import { useWalkingLegs } from "@/lib/use-walking-legs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { nearbyByPlace } from "@/lib/catalog-filter";
import { assignQueued, queueUpdate } from "@/lib/queue-actions";
import { usePlanStore } from "@/lib/plan-store";
import { homeHref } from "@/lib/links";
import {
  useCitiesById,
  usePlacesById,
  useTrip,
  useTripDays,
} from "@/lib/trip-store";
import { useQueue } from "@/lib/use-queue";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { useTripId } from "@/lib/use-trip-id";

type Props = {
  date: string;
  label: string;
  cityNames: string[];
  cityIds: string[];
  start: Endpoint | null;
  end: Endpoint | null;
  reservations: Reservation[];
};

export function DayPlan(props: Props) {
  const tripId = useTripId();
  const items = usePlanStore((s) => s.items);
  const placesById = usePlacesById();
  const citiesById = useCitiesById();
  const trip = useTrip();
  const tripDays = useTripDays();
  const queue = useQueue(tripId).items;
  const [dragging, setDragging] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [openPlaceId, setOpenPlaceId] = useState<string | null>(null);
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

  // Wide screens: what can be dragged in from the side panel, and the other
  // days of this day's cities to drop a stop on.
  const waiting = useMemo(() => {
    const planned = new Set(
      items.filter((i) => i.status !== "removed").map((i) => i.placeId),
    );
    const drafts = trip.places
      .filter(
        (p) =>
          isDraft(p) && props.cityIds.includes(p.cityId) && !planned.has(p.id),
      )
      .map((p) => ({
        dragId: placeDragId(p.id),
        name: p.name,
        detail: t("common.notResearched"),
      }));
    const links = queue
      .filter((q) => q.status === "queued")
      .map((q) => ({
        dragId: queueDragId(q.id),
        name: q.name ?? t("day.shortLink"),
        detail: t("day.queuedLink"),
      }));
    return [...drafts, ...links];
  }, [items, trip.places, queue, props.cityIds]);
  const otherDays = tripDays.filter(
    (d) =>
      d.date !== props.date && d.cityIds.some((c) => props.cityIds.includes(c)),
  );
  const stopCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items)
      if (i.status !== "removed")
        counts.set(i.date, (counts.get(i.date) ?? 0) + 1);
    return counts;
  }, [items]);

  function sourceFor(id: string): DragSource | null {
    const parsed = parseDragId(id);
    if (parsed?.kind === "place") {
      const place = placesById.get(parsed.value);
      return place
        ? { kind: "place", placeId: place.id, cityId: place.cityId }
        : null;
    }
    if (parsed?.kind === "queue") {
      const q = queue.find((i) => i.id === parsed.value);
      return q
        ? {
            kind: "queued",
            queueId: q.id,
            cityId: q.cityId ?? suggestCity(q, trip.places, trip.stays),
          }
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
    if (source.kind === "place")
      return placesById.get(source.placeId)?.name ?? t("day.thisPlace");
    return (
      queue.find((q) => q.id === source.queueId)?.name ?? t("day.thisPlace")
    );
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
      date: props.date,
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

    const added =
      source.kind === "place"
        ? addPlaceAt(
            id,
            source.placeId,
            plan.date,
            plan.index,
            dayItems(plan.date),
          )
        : assignQueued(
            id,
            queue.find((q) => q.id === source.queueId)!,
            plan.cityId!,
            plan.date,
            new Date(),
            plan.index,
          ).then((r) => r.stop!);
    added
      .then((stop) =>
        toast(t("common.addedToDay", { name: nameOf(source), day: label }), {
          action: {
            label: t("common.undo"),
            onClick: () => {
              undo(removeItem(id, stop));
              if (source.kind === "queued") {
                const q = queue.find((i) => i.id === source.queueId);
                if (q) undo(queueUpdate(id, q, { status: "queued" }));
              }
            },
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

  const next = nextStop(stops);
  const lateEnd = dayRunsLate(
    stops.filter((i) => i.status === "planned"),
    placesById,
  );
  const editingItem = stops.find((i) => i.id === editing);
  const holiday = trip.holidays.find((h) => h.date === props.date);

  function saveEdit(item: PlanItem, changes: StopChanges) {
    setEditing(null);
    if (!tripId) return;
    updateItem(tripId, item, changes).catch(() =>
      toast.error(t("common.refused")),
    );
  }
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

  const map = dayMap(rows, props.start, props.end);
  const legs = dayLegs(rows, props.start, props.end);
  const walking = useWalkingLegs(legs);
  const mapLines = legs.flatMap((leg): MapLine[] => {
    if (!leg.from || !leg.to) return [];
    const route = walking.get(leg.key);
    return [
      route && route.path.length > 1
        ? { path: route.path, kind: "walk" }
        : { path: [leg.from, leg.to], kind: "straight" },
    ];
  });
  const legLine = (key: string) => {
    const leg = legs.find((l) => l.key === key);
    return leg ? <LegLine leg={leg} walking={walking.get(key)} /> : null;
  };
  const mapNote =
    map.unpinned > 0 ? t("day.mapNote", { count: map.unpinned }) : null;
  const openPlace = openPlaceId ? placesById.get(openPlaceId) : undefined;
  const openNearby = openPlace
    ? (nearbyByPlace(trip.places)[openPlace.id] ?? []).map((n) => ({
        id: n.id,
        name: n.name,
      }))
    : [];
  const showPhoneMap = !wide && view === "map";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={homeHref(tripId)}
            className="text-sm text-muted-foreground underline"
          >
            {t("common.backToDays")}
          </Link>
        </div>
        <h1 className="text-2xl font-semibold">{props.label}</h1>
        <CostLine places={stops.map((i) => placesById.get(i.placeId))} />
        {holiday && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="font-medium">{holiday.name}.</span> {holiday.note}
          </p>
        )}
        {lateEnd && (
          <p className="text-sm text-destructive">
            {t("day.runsLate", { time: lateEnd })}
          </p>
        )}
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
                {t("day.goNext")}
              </a>
            </Button>
          ) : (
            <Button size="sm" disabled>
              {t("day.noStopsLeft")}
            </Button>
          )}
          <FullDay start={props.start} end={props.end} stops={stops} />
        </div>
        {!wide && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => {
              if (value) setView(value as "list" | "map");
            }}
            className="justify-start"
          >
            <ToggleGroupItem value="list">{t("common.list")}</ToggleGroupItem>
            <ToggleGroupItem value="map">{t("common.map")}</ToggleGroupItem>
          </ToggleGroup>
        )}
      </header>

      {showPhoneMap && (
        <TripMap
          pins={map.pins}
          lines={mapLines}
          onPinClick={setOpenPlaceId}
          className="h-[65vh]"
          note={mapNote}
        />
      )}

      {!wide && !showPhoneMap && props.start && (
        <HotelRow label={t("day.start")} endpoint={props.start} />
      )}

      {wide ? (
        <DndContext
          sensors={sensors}
          collisionDetection={preferItems}
          onDragStart={({ active }) => setDragging(String(active.id))}
          onDragCancel={() => setDragging(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <SortableContext
              items={rows.map((r) => r.item.id)}
              strategy={verticalListSortingStrategy}
            >
              <DroppableList empty={rows.length === 0}>
                {rows.map((row) => (
                  <SortableStop
                    key={row.item.id}
                    id={row.item.id}
                    item={row.item}
                    place={row.place}
                    leg={legLine(row.item.id)}
                    dayOptions={dayOptionsFor(row.place?.cityId)}
                    currentDate={props.date}
                    onRemove={() => remove(row.item)}
                    onEdit={() => setEditing(row.item.id)}
                    onMoveDay={(d) => moveToDay(row.item, d)}
                  />
                ))}
                {rows.length > 0 && <li>{legLine("end")}</li>}
              </DroppableList>
            </SortableContext>
            <div className="sticky top-20 flex flex-col gap-4">
              <TripMap
                pins={map.pins}
                lines={mapLines}
                onPinClick={setOpenPlaceId}
                className="h-72 xl:h-96"
                note={mapNote}
              />
              {props.start && (
                <HotelRow label={t("day.start")} endpoint={props.start} />
              )}
              {props.end && (
                <HotelRow label={t("day.end")} endpoint={props.end} />
              )}
              <Reservations reservations={props.reservations} />
              <DaySidePanel
                waiting={waiting}
                otherDays={otherDays}
                stopCounts={stopCounts}
              />
            </div>
          </div>
          <DragOverlay>
            {dragging && parseDragId(dragging) ? (
              <DragPreview
                name={
                  waiting.find((w) => w.dragId === dragging)?.name ??
                  t("day.place")
                }
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        !showPhoneMap && (
          <ol className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <li key={row.item.id} className="flex flex-col gap-3">
                {legLine(row.item.id)}
                <StopCard
                  item={row.item}
                  place={row.place}
                  dayOptions={dayOptionsFor(row.place?.cityId)}
                  currentDate={props.date}
                  onRemove={() => remove(row.item)}
                  onEdit={() => setEditing(row.item.id)}
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
            {rows.length > 0 && <li>{legLine("end")}</li>}
          </ol>
        )
      )}

      {stops.length === 0 && !wide && !showPhoneMap && (
        <p className="text-sm text-muted-foreground">{t("day.noStopsPhone")}</p>
      )}

      {!wide && !showPhoneMap && props.end && (
        <HotelRow label={t("day.end")} endpoint={props.end} />
      )}

      {!wide && !showPhoneMap && (
        <Reservations reservations={props.reservations} />
      )}
      <PlaceDetails
        place={openPlace ?? null}
        nearby={openNearby}
        onOpenChange={(open) => {
          if (!open) setOpenPlaceId(null);
        }}
      />
      {editingItem && (
        <StopEditor
          key={editingItem.id}
          item={editingItem}
          place={placesById.get(editingItem.placeId)}
          onCancel={() => setEditing(null)}
          onSave={(changes) => saveEdit(editingItem, changes)}
        />
      )}
    </div>
  );
}

// Drops land on the most specific target under the pointer: a stop or a
// day before the list around them. Keyboard drags have no pointer, so they
// fall back to the nearest target.
const preferItems: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  const specific = within.filter((c) => c.id !== LIST_ID);
  if (specific.length) return specific;
  if (within.length) return within;
  return closestCenter(args);
};

function DroppableList({
  empty,
  children,
}: {
  empty: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useListDrop();
  return (
    <ol
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 flex-col gap-3 rounded-xl",
        empty && "items-center justify-center border border-dashed p-6",
        isOver && "bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      {children}
      {empty && (
        <li className="text-center text-sm text-muted-foreground">
          {t("day.noStopsWide")}
        </li>
      )}
    </ol>
  );
}

// The day's bookings (flights, trains, tickets) from the trip settings.
function Reservations({ reservations }: { reservations: Reservation[] }) {
  if (reservations.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground uppercase">
        {t("day.reservations")}
      </h2>
      {reservations.map((r, i) => (
        <Card key={`${r.type}-${i}`} size="sm">
          <CardContent className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t(`reservationType.${r.type}`)}</Badge>
              {r.time && <span className="font-medium">{r.time}</span>}
            </div>
            <div>
              {r.from && r.to ? `${r.from} → ${r.to}` : (r.from ?? r.to ?? "")}
            </div>
            {r.note && <div className="text-muted-foreground">{r.note}</div>}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function HotelRow({ label, endpoint }: { label: string; endpoint: Endpoint }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground uppercase">
            {t("day.hotelRow", { label })}
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
              {t("common.directions")}
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
  dayOptions: { date: string; label: string }[];
  currentDate: string;
  onRemove: () => void;
  onEdit: () => void;
  onMoveDay: (date: string) => void;
};

// Wide screens: drag the grip to reorder, or focus it and use Space and the
// arrow keys.
function SortableStop({
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
          <button
            type="button"
            aria-label={t("day.dragToReorder")}
            className="mt-0.5 cursor-grab touch-none rounded-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
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
  dayOptions,
  currentDate,
  onRemove,
  onEdit,
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
  const { holidays } = useTrip();
  const name = place?.name ?? item.placeId;
  const times = stopTimes(item, place);
  const minutes = item.durationMin ?? null;
  const meta = times
    ? times.end
      ? `${times.start}–${times.end}`
      : times.start
    : minutes
      ? t("common.minutes", { minutes })
      : null;
  const finished = item.status === "done" || item.status === "skipped";
  const warnings = place
    ? [
        ...stopWarnings(place, item.date, t),
        ...holidayWarnings(place, item.date, holidays, t),
        ...timeWarnings(item, place, t),
      ]
    : [];

  return (
    <Card size="sm" className={cn(finished && "opacity-70")}>
      <CardHeader className="flex items-start gap-3">
        {handle}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle
            className={cn(
              "text-base",
              item.status === "done" && "line-through",
            )}
          >
            {name}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {place && (
              <Badge variant="secondary">{categoryLabel(place.category)}</Badge>
            )}
            {finished && (
              <Badge>
                {item.status === "done"
                  ? t("common.done")
                  : t("common.skipped")}
              </Badge>
            )}
            {meta && <Badge variant="outline">{meta}</Badge>}
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
        {item.note && <p className="text-sm">{item.note}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {place && (
            <Button asChild variant="outline" size="sm">
              <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                {t("common.map")}
              </a>
            </Button>
          )}
          {buttons && (
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
          {dayOptions.length > 1 && (
            <Select value={currentDate} onValueChange={onMoveDay}>
              <SelectTrigger size="sm" className="w-44">
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("common.editName", { name })}
            className="ml-auto"
            onClick={onEdit}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("day.remove")}
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
  const placesById = usePlacesById();
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
  }, [start, end, stops, placesById]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          {t("day.fullDay")}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{t("day.fullDay")}</SheetTitle>
          <SheetDescription>{t("day.fullDayDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-6">
          {legs === null && (
            <p className="text-sm text-muted-foreground">
              {t("day.fullDayNeedsHotel")}
            </p>
          )}
          {legs?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("day.noStops")}</p>
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
