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
  BedDouble,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Info,
  Navigation,
  Plus,
  SkipForward,
  Ticket,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  SheetBody,
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
  nextStop,
  placeLocation,
  stopWarnings,
  waitingPlaces,
} from "@/domain/plan";
import type { PlanItem, Place, Reservation } from "@/domain/schemas";
import type { Endpoint } from "@/domain/trip";
import { planDrop, type DragSource, type DropTarget } from "@/domain/drop";
import { isDraft } from "@/domain/place-edit";
import {
  DayColumn,
  DragPreview,
  LIST_ID,
  type Waiting,
  OtherDaysColumn,
  parseDragId,
  placeDragId,
  useListDrop,
  WaitingColumn,
  WaitingTags,
} from "@/components/day-side-panel";
import { LogCostButton, placePrefill } from "@/components/expense-form";
import { Tip } from "@/components/tip";
import { t } from "@/lib/i18n";
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
import { CategoryBadge, PriorityBadge } from "@/components/tag-badges";
import { LegLine } from "@/components/leg-line";
import { TripMap } from "@/components/trip-map";
import { dayLegs } from "@/domain/legs";
import { dayMap, stopColor } from "@/domain/map-pins";
import type { MapLine } from "@/domain/maps-service";
import { useWalkingLegs } from "@/lib/use-walking-legs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { nearbyByPlace } from "@/lib/catalog-filter";
import { usePlanStore } from "@/lib/plan-store";
import { daysHref } from "@/lib/links";
import {
  useCitiesById,
  usePlacesById,
  useTrip,
  useTripDays,
} from "@/lib/trip-store";
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
  const [dragging, setDragging] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map" | "waiting">("list");
  const [adding, setAdding] = useState<Waiting | null>(null);
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
  const waiting = useMemo(
    () =>
      waitingPlaces(trip.places, items, props.cityIds).map((place) => ({
        dragId: placeDragId(place.id),
        place,
      })),
    [items, trip.places, props.cityIds],
  );
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
  const holiday = trip.holidays.find((h) => h.date === props.date);

  // Tapping the status a stop already has takes it back to planned.
  function mark(item: PlanItem, status: StopOutcome) {
    if (!tripId) return;
    updateItem(tripId, item, {
      status: item.status === status ? "planned" : status,
    }).catch(() => toast.error(t("common.refused")));
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
  const showPhoneList = !wide && view === "list";
  const draggingName = dragging
    ? parseDragId(dragging)
      ? waiting.find((w) => w.dragId === dragging)?.place.name
      : rows.find((r) => r.item.id === dragging)?.place?.name
    : null;

  return (
    <div className="flex flex-col gap-4 md:h-[calc((100svh-6.5rem-1px)*1.24)] md:min-h-[48rem] lg:h-[calc((100svh-7.5rem-1px)*1.24)]">
      <header className="flex flex-col gap-2">
        <Link
          href={daysHref(tripId)}
          className="text-sm text-muted-foreground underline"
        >
          {t("common.backToDays")}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold">{props.label}</h1>
          {props.cityNames.map((name) => (
            <Badge key={name} variant="secondary">
              {name}
            </Badge>
          ))}
        </div>
        <CostLine places={stops.map((i) => placesById.get(i.placeId))} />
        {holiday && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="font-medium">{holiday.name}.</span> {holiday.note}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {nextPlace ? (
            <Tip label={t("day.tipGoNext", { name: nextPlace.name })}>
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
            </Tip>
          ) : (
            <Button size="sm" disabled>
              {t("day.noStopsLeft")}
            </Button>
          )}
          <FullDay start={props.start} end={props.end} stops={stops} />
          <HotelButtons start={props.start} end={props.end} />
          {wide && <BookingsButton reservations={props.reservations} />}
        </div>
        {!wide && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => {
              if (value) setView(value as typeof view);
            }}
            className="justify-start"
          >
            <ToggleGroupItem value="list">{t("common.list")}</ToggleGroupItem>
            <ToggleGroupItem value="map">{t("common.map")}</ToggleGroupItem>
            <ToggleGroupItem value="waiting">
              {t("day.waitingTab", { count: waiting.length })}
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </header>

      {showPhoneMap && (
        <TripMap
          pins={map.pins}
          lines={mapLines}
          onPinClick={setOpenPlaceId}
          className="h-[65svh]"
          note={mapNote}
        />
      )}

      {wide ? (
        <DndContext
          sensors={sensors}
          collisionDetection={preferItems}
          onDragStart={({ active }) => setDragging(String(active.id))}
          onDragCancel={() => setDragging(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <DayColumn title={t("day.stopsColumn")}>
              <SortableContext
                items={rows.map((r) => r.item.id)}
                strategy={verticalListSortingStrategy}
              >
                <DroppableList empty={rows.length === 0}>
                  {rows.map((row, index) => (
                    <SortableStop
                      key={row.item.id}
                      id={row.item.id}
                      number={index + 1}
                      item={row.item}
                      place={row.place}
                      leg={legLine(row.item.id)}
                      dayOptions={dayOptionsFor(row.place?.cityId)}
                      currentDate={props.date}
                      onRemove={() => remove(row.item)}
                      onMark={(status) => mark(row.item, status)}
                      onMoveDay={(d) => moveToDay(row.item, d)}
                      onOpenPlace={() => setOpenPlaceId(row.item.placeId)}
                    />
                  ))}
                  {rows.length > 0 && <li>{legLine("end")}</li>}
                </DroppableList>
              </SortableContext>
            </DayColumn>
            <WaitingColumn waiting={waiting} />
            <OtherDaysColumn otherDays={otherDays} stopCounts={stopCounts} />
          </div>
          <div className="h-[38.7%] min-h-80 shrink-0">
            <TripMap
              pins={map.pins}
              lines={mapLines}
              onPinClick={setOpenPlaceId}
              className="min-h-0 flex-1"
              note={mapNote}
            />
          </div>
          {/* The columns clip what's inside them, so what's being dragged
              follows the pointer above them. */}
          <DragOverlay>
            {dragging ? (
              <DragPreview name={draggingName ?? t("day.place")} />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        showPhoneList && (
          <ol className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <li key={row.item.id} className="flex flex-col gap-3">
                {legLine(row.item.id)}
                <StopCard
                  number={index + 1}
                  item={row.item}
                  place={row.place}
                  dayOptions={dayOptionsFor(row.place?.cityId)}
                  currentDate={props.date}
                  onRemove={() => remove(row.item)}
                  onMark={(status) => mark(row.item, status)}
                  onMoveDay={(d) => moveToDay(row.item, d)}
                  onOpenPlace={() => setOpenPlaceId(row.item.placeId)}
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

      {stops.length === 0 && showPhoneList && (
        <p className="text-sm text-muted-foreground">{t("day.noStopsPhone")}</p>
      )}

      {!wide && view === "waiting" && (
        <PhoneWaiting waiting={waiting} onChoose={setAdding} />
      )}
      <AlertDialog
        open={adding !== null}
        onOpenChange={(open) => !open && setAdding(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("day.addWaitingTitle", {
                name: adding?.place.name ?? "",
                day: props.label,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("day.addWaitingBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (adding)
                  addToDay(adding.place.id, props.date, stops.length, stops);
                setAdding(null);
              }}
            >
              {t("common.addToDay")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showPhoneList && <Reservations reservations={props.reservations} />}
      <PlaceDetails
        place={openPlace ?? null}
        nearby={openNearby}
        onOpenChange={(open) => {
          if (!open) setOpenPlaceId(null);
        }}
      />
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
        "flex min-h-full flex-col gap-3 rounded-xl",
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

// Phones can't drag, so a place waiting is added by tapping it.
function PhoneWaiting({
  waiting,
  onChoose,
}: {
  waiting: Waiting[];
  onChoose: (place: Waiting) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {waiting.length === 0 ? t("day.waitingNone") : t("day.waitingTap")}
      </p>
      <ul className="flex flex-col gap-2">
        {waiting.map((w) => (
          <li key={w.dragId}>
            <Button
              variant="outline"
              className="h-auto w-full justify-between gap-3 rounded-lg py-3 text-left whitespace-normal"
              onClick={() => onChoose(w)}
            >
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="font-medium">{w.place.name}</span>
                <WaitingTags place={w.place} />
              </span>
              <Plus />
            </Button>
          </li>
        ))}
      </ul>
    </section>
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

// Wide screens: the day's bookings behind a button, to leave room for the plan.
function BookingsButton({ reservations }: { reservations: Reservation[] }) {
  if (reservations.length === 0) return null;
  return (
    <Sheet>
      <Tip label={t("day.tipBookings")}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <Ticket />
            {t("day.bookings", { count: reservations.length })}
          </Button>
        </SheetTrigger>
      </Tip>
      <SheetContent side="right">
        <SheetHeader className="text-left">
          <SheetTitle>{t("day.reservations")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("day.tipBookings")}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <Reservations reservations={reservations} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

// Directions to the day's hotel. Most days start and end at the same one, and
// that needs only one button.
function HotelButtons({
  start,
  end,
}: {
  start: Endpoint | null;
  end: Endpoint | null;
}) {
  if (start && end && start.name === end.name)
    return <HotelButton text={start.name} endpoint={start} />;
  return (
    <>
      {start && (
        <HotelButton
          text={t("day.hotelEndpoint", {
            label: t("day.start"),
            name: start.name,
          })}
          endpoint={start}
        />
      )}
      {end && (
        <HotelButton
          text={t("day.hotelEndpoint", { label: t("day.end"), name: end.name })}
          endpoint={end}
        />
      )}
    </>
  );
}

function HotelButton({ text, endpoint }: { text: string; endpoint: Endpoint }) {
  const label = <span className="max-w-48 truncate">{text}</span>;
  if (!endpoint.location)
    return (
      <Button variant="outline" size="sm" disabled>
        <BedDouble />
        {label}
      </Button>
    );
  return (
    <Tip label={t("day.tipHotel", { name: endpoint.name })}>
      <Button asChild variant="outline" size="sm">
        <a
          href={directionsUrl(endpoint.location)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BedDouble />
          {label}
        </a>
      </Button>
    </Tip>
  );
}

type StopOutcome = "done" | "skipped";

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
        }
      />
    </li>
  );
}

// Phones use the up/down buttons instead of dragging.
function StopCard({
  number,
  item,
  place,
  dayOptions,
  currentDate,
  onRemove,
  onMark,
  onMoveDay,
  onOpenPlace,
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
  const tripId = useTripId();
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("day.remove")}
            className={cn(!(place && tripId) && "ml-auto")}
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
      <Tip label={t("day.tipFullDay")}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            {t("day.fullDay")}
          </Button>
        </SheetTrigger>
      </Tip>
      <SheetContent
        side="bottom"
        className="max-h-[80dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{t("day.fullDay")}</SheetTitle>
          <SheetDescription>{t("day.fullDayDescription")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="gap-2">
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
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
