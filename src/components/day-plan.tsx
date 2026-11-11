"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Info, Navigation, Plus } from "lucide-react";
import Link from "next/link";

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
import {
  directionsUrl,
  itemsForDay,
  nextStop,
  placeLocation,
  waitingPlaces,
} from "@/domain/plan";
import type { FlightRecord, Reservation } from "@/domain/schemas";
import type { Endpoint } from "@/domain/trip";
import {
  DayColumn,
  DragPreview,
  WaitingControls,
  waitingHint,
  LIST_ID,
  type Waiting,
  OtherDaysColumn,
  parseDragId,
  placeDragId,
  useListDrop,
  WaitingColumn,
  WaitingTags,
} from "@/components/day-side-panel";
import { Tip } from "@/components/tip";
import { t } from "@/lib/i18n";
import { CostLine } from "@/components/cost-line";
import { FlightCard } from "@/components/flight-card";
import { formatDayLabel } from "@/lib/format-day";
import { PlaceDetails } from "@/components/place-details";
import { LegLine } from "@/components/leg-line";
import { DayResearchPanel } from "@/components/day-research";
import { QuickExpenseButton } from "@/components/quick-expense";
import { DayWeatherStrip } from "@/components/day-weather";
import { useDaysWeather } from "@/lib/use-weather";
import { TripMap, type MapFocus } from "@/components/trip-map";
import {
  MapHotelsControl,
  NO_HOTELS,
  type HotelsShown,
} from "@/components/map-hotels";
import { dayLegs } from "@/domain/legs";
import { cityPins, dayMap, endpointPoint, placePoint } from "@/domain/map-pins";
import { applyWaitingView, DEFAULT_WAITING_VIEW } from "@/domain/waiting-view";
import type { MapLine } from "@/domain/maps-service";
import { useWalkingLegs } from "@/lib/use-walking-legs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { nearbyByPlace } from "@/lib/catalog-filter";
import { usePlanStore } from "@/lib/plan-store";
import { daysHref, pageHref } from "@/lib/links";
import {
  useCitiesById,
  usePlacesById,
  useTrip,
  useTripDays,
} from "@/lib/trip-store";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { useTripId } from "@/lib/use-trip-id";
import { useReadOnly } from "@/lib/viewer-store";
import { useDayPlanActions } from "@/lib/use-day-plan-actions";
import {
  FullDay,
  BookingsButton,
  HotelButtons,
  Reservations,
} from "@/components/day-plan-links";
import { SortableStop, StopCard } from "@/components/day-plan-stop";

type Props = {
  date: string;
  label: string;
  cityNames: string[];
  cityIds: string[];
  start: Endpoint | null;
  end: Endpoint | null;
  reservations: Reservation[];
  flights: FlightRecord[];
};

export function DayPlan(props: Props) {
  // A read-only link can look around the day but change nothing: no
  // dragging, no stop actions, nothing to add.
  const readOnly = useReadOnly();
  const memberTripId = useTripId();
  const tripId = readOnly ? null : memberTripId;
  const items = usePlanStore((s) => s.items);
  const placesById = usePlacesById();
  const citiesById = useCitiesById();
  const trip = useTrip();
  const tripDays = useTripDays();
  const [view, setView] = useState<"list" | "map" | "waiting">("list");
  const [adding, setAdding] = useState<Waiting | null>(null);
  const [openPlaceId, setOpenPlaceId] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const outlook = useDaysWeather([
    { date: props.date, city: props.cityNames[0] ?? null },
  ]);
  const [waitingView, setWaitingView] = useState(DEFAULT_WAITING_VIEW);
  const [waitingOnMap, setWaitingOnMap] = useState(false);
  const [hotels, setHotels] = useState<HotelsShown>(NO_HOTELS);
  const wide = useMediaQuery("(min-width: 768px)");
  const stops = useMemo(
    () => itemsForDay(items, props.date),
    [items, props.date],
  );
  const {
    sensors,
    dragging,
    setDragging,
    handleDragEnd,
    addToDay,
    stepBy,
    moveToDay,
    remove,
    mark,
  } = useDayPlanActions({
    tripId,
    date: props.date,
    items,
    stops,
    placesById,
    citiesById,
    tripDays,
  });

  // Wide screens: what can be dragged in from the side panel, and the other
  // days of this day's cities to drop a stop on.
  const allWaiting = useMemo(
    () => waitingPlaces(trip.places, items, props.cityIds),
    [items, trip.places, props.cityIds],
  );
  const waiting = useMemo(
    () =>
      applyWaitingView(allWaiting, waitingView).map((place) => ({
        dragId: placeDragId(place.id),
        place,
      })),
    [allWaiting, waitingView],
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

  const next = nextStop(stops);
  const holiday = trip.holidays.find((h) => h.date === props.date);

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
  const placesOfDay = rows.flatMap((r) =>
    r.place && !r.place.archived ? [r.place] : [],
  );

  // Hotels are on the map only when asked for: a moving day's two hotels
  // would otherwise stretch the map across both cities.
  const map = dayMap(
    rows,
    hotels.start ? props.start : null,
    hotels.end ? props.end : null,
  );
  const legs = dayLegs(rows, props.start, props.end);
  const walking = useWalkingLegs(legs);
  const hiddenLeg = (key: string) =>
    (key === "end" && !hotels.end) ||
    (key === rows[0]?.item.id && props.start !== null && !hotels.start);
  const mapLines = legs.flatMap((leg): MapLine[] => {
    if (!leg.from || !leg.to || hiddenLeg(leg.key)) return [];
    const route = walking.get(leg.key);
    return [
      route && route.path.length > 1
        ? { path: route.path, kind: "walk" }
        : { path: [leg.from, leg.to], kind: "straight" },
    ];
  });
  const legLine = (key: string) => {
    const leg = legs.find((l) => l.key === key);
    if (!leg) return null;
    const label =
      key === "end" && props.end
        ? t("leg.backToHotel", { name: props.end.name })
        : key === rows[0]?.item.id && props.start
          ? t("leg.fromHotel", { name: props.start.name })
          : null;
    return <LegLine leg={leg} walking={walking.get(key)} label={label} />;
  };
  // Without coordinates a hotel has no pin, distance or walking time.
  const hotelsOffMap = [
    ...new Set(
      [props.start, props.end].flatMap((hotel) =>
        hotel?.location && !endpointPoint(hotel) ? [hotel.name] : [],
      ),
    ),
  ];
  const waitingShown = waiting.map((w) => w.place);
  const pins = waitingOnMap
    ? [...map.pins, ...cityPins(waitingShown)]
    : map.pins;
  const waitingUnpinned = waitingOnMap
    ? waitingShown.filter((place) => !placePoint(place)).length
    : 0;
  const mapNote =
    [
      map.unpinned > 0 ? t("day.mapNote", { count: map.unpinned }) : null,
      waitingUnpinned > 0
        ? t("day.waitingUnpinned", { count: waitingUnpinned })
        : null,
    ]
      .filter(Boolean)
      .join(" ") || null;
  const waitingControls = (
    <WaitingControls
      view={waitingView}
      onViewChange={setWaitingView}
      shown={waiting.length}
      total={allWaiting.length}
      onMap={waitingOnMap}
      onMapChange={(on) => {
        setWaitingOnMap(on);
        // On phones the map is its own tab, so go and show them there.
        if (on && !wide) setView("map");
      }}
    />
  );
  const mapToolbar = (
    <MapHotelsControl
      start={props.start}
      end={props.end}
      value={hotels}
      onChange={setHotels}
    />
  );
  const openPlace = openPlaceId ? placesById.get(openPlaceId) : undefined;
  function showOnMap() {
    if (!openPlace) return;
    setOpenPlaceId(null);
    // On phones the map is its own tab.
    if (!wide) setView("map");
    setMapFocus({ id: openPlace.id });
  }
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
        <DayWeatherStrip outlook={outlook.get(props.date)} />
        {holiday && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="font-medium">{holiday.name}.</span> {holiday.note}
          </p>
        )}
        {hotelsOffMap.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("day.hotelOffMap", { name: hotelsOffMap.join(", ") })}{" "}
            {!readOnly && (
              <Link
                href={pageHref("/settings/", tripId, { tab: "stays" })}
                className="underline"
              >
                {t("day.hotelOffMapFix")}
              </Link>
            )}
          </p>
        )}
        {props.flights.length > 0 && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {props.flights.map((flight) => (
              <FlightCard key={flight.id} flight={flight} />
            ))}
          </div>
        )}
        <DayResearchPanel
          date={props.date}
          placesOfDay={placesOfDay}
          placesById={placesById}
          onOpenPlace={setOpenPlaceId}
        />
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
          <QuickExpenseButton date={props.date} className="ml-auto" />
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
              {t("day.waitingTab", { count: allWaiting.length })}
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </header>

      {showPhoneMap && waitingOnMap && waitingControls}
      {showPhoneMap && (
        <TripMap
          pins={pins}
          lines={mapLines}
          onPinClick={setOpenPlaceId}
          focus={mapFocus}
          className="h-[65svh]"
          note={mapNote}
          toolbar={mapToolbar}
        />
      )}

      {wide ? (
        <DndContext
          sensors={readOnly ? NO_SENSORS : sensors}
          collisionDetection={preferItems}
          onDragStart={({ active }) => setDragging(String(active.id))}
          onDragCancel={() => setDragging(null)}
          onDragEnd={handleDragEnd}
        >
          {/* Two columns: the stops on the left, the full height, so there's
              room to drag; on the right what's waiting, the other days (kept
              small) and the map under them. */}
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
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
                      readOnly={readOnly}
                    />
                  ))}
                  {rows.length > 0 && <li>{legLine("end")}</li>}
                </DroppableList>
              </SortableContext>
            </DayColumn>
            <div className="flex min-h-0 flex-col gap-4">
              <div className="grid h-[42%] min-h-64 shrink-0 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
                <WaitingColumn
                  waiting={waiting}
                  total={allWaiting.length}
                  controls={waitingControls}
                  onOpen={readOnly ? setOpenPlaceId : undefined}
                />
                <OtherDaysColumn
                  otherDays={otherDays}
                  stopCounts={stopCounts}
                  readOnly={readOnly}
                />
              </div>
              <div className="flex min-h-80 flex-1 flex-col">
                <TripMap
                  pins={pins}
                  lines={mapLines}
                  onPinClick={setOpenPlaceId}
                  focus={mapFocus}
                  className="min-h-0 flex-1"
                  note={mapNote}
                  toolbar={mapToolbar}
                />
              </div>
            </div>
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
                  readOnly={readOnly}
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
        <PhoneWaiting
          waiting={waiting}
          total={allWaiting.length}
          controls={waitingControls}
          onChoose={readOnly ? (w) => setOpenPlaceId(w.place.id) : setAdding}
          readOnly={readOnly}
        />
      )}
      <AlertDialog
        open={adding !== null && !readOnly}
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
        onShowOnMap={
          openPlace && pins.some((pin) => pin.id === openPlace.id)
            ? showOnMap
            : undefined
        }
      />
    </div>
  );
}

// A read-only link can't drag anything.
const NO_SENSORS: SensorDescriptor<SensorOptions>[] = [];

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
  total,
  controls,
  onChoose,
  readOnly,
}: {
  waiting: Waiting[];
  total: number;
  controls: ReactNode;
  onChoose: (place: Waiting) => void;
  readOnly: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      {controls}
      <p className="text-sm text-muted-foreground">
        {waitingHint(
          waiting.length,
          total,
          readOnly ? t("share.waitingHint") : t("day.waitingTap"),
        )}
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
              {readOnly ? <Info /> : <Plus />}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
