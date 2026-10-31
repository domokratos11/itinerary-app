import { isDraft, needsResearch } from "./place-edit";
import { tripPhase, type TripDay } from "./days";
import {
  CATEGORIES,
  PRIORITIES,
  type Category,
  type HolidayRecord,
  type PlaceRecord,
  type PlanItem,
  type Priority,
  type ReservationRecord,
  type StayRecord,
} from "./schemas";

const active = (items: PlanItem[]) =>
  items.filter((i) => i.status !== "removed");

export type TripClock =
  | { phase: "none" }
  | { phase: "before"; daysUntil: number; totalDays: number; first: string }
  | {
      phase: "during";
      dayNumber: number;
      totalDays: number;
      daysLeft: number;
    }
  | { phase: "after"; totalDays: number };

// Where today (in Tokyo) falls in the trip.
export function tripClock(today: string, days: TripDay[]): TripClock {
  if (days.length === 0) return { phase: "none" };
  const phase = tripPhase(today, days);
  if (phase.phase === "before")
    return {
      phase: "before",
      daysUntil: phase.daysLeft,
      totalDays: days.length,
      first: phase.first,
    };
  if (phase.phase === "after")
    return { phase: "after", totalDays: days.length };
  const index = days.findIndex((d) => d.date === today);
  return {
    phase: "during",
    dayNumber: index + 1,
    totalDays: days.length,
    daysLeft: days.length - index - 1,
  };
}

// Whole hours left before midnight in Japan, rounded up.
export function hoursLeftInTokyoDay(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Math.ceil((24 * 60 - (part("hour") * 60 + part("minute"))) / 60);
}

export function stopCounts(items: PlanItem[]): {
  planned: number;
  done: number;
  skipped: number;
} {
  const count = (status: PlanItem["status"]) =>
    items.filter((i) => i.status === status).length;
  return {
    planned: count("planned"),
    done: count("done"),
    skipped: count("skipped"),
  };
}

export function stopsLeftToday(items: PlanItem[], today: string): number {
  return items.filter((i) => i.date === today && i.status === "planned").length;
}

export type DayStops = {
  date: string;
  total: number;
  byCity: Record<string, number>;
};

// Active stops on each trip day, split by the city of their place. A stop
// whose place is gone counts under "other".
export function stopsPerDay(
  days: TripDay[],
  items: PlanItem[],
  placesById: ReadonlyMap<string, Pick<PlaceRecord, "cityId">>,
): DayStops[] {
  const stops = active(items);
  return days.map((d) => {
    const byCity: Record<string, number> = {};
    const own = stops.filter((i) => i.date === d.date);
    for (const item of own) {
      const city = placesById.get(item.placeId)?.cityId ?? "other";
      byCity[city] = (byCity[city] ?? 0) + 1;
    }
    return { date: d.date, total: own.length, byCity };
  });
}

// Days from today on with at most `limit` stops: room to fit more in.
export function quietDays(
  perDay: DayStops[],
  today: string,
  limit = 1,
): DayStops[] {
  return perDay.filter((d) => d.date >= today && d.total <= limit);
}

export function placesByCategory(
  places: Pick<PlaceRecord, "category">[],
): { category: Category; count: number }[] {
  return CATEGORIES.map((category) => ({
    category,
    count: places.filter((p) => p.category === category).length,
  }));
}

export function placesByPriority(
  places: Pick<PlaceRecord, "priority">[],
): { priority: Priority; count: number }[] {
  return PRIORITIES.map((priority) => ({
    priority,
    count: places.filter((p) => p.priority === priority).length,
  }));
}

// Must-sees that aren't on any day yet.
export function mustsNotPlanned(
  places: PlaceRecord[],
  items: PlanItem[],
): PlaceRecord[] {
  const planned = new Set(active(items).map((i) => i.placeId));
  return places.filter((p) => p.priority === "must" && !planned.has(p.id));
}

export type CityFigures = {
  cityId: string;
  places: number;
  inPlan: number;
  estimateYen: number;
  nights: number;
};

const nightsBetween = (checkIn: string, checkOut: string) =>
  Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) /
      86_400_000,
  );

export function cityFigures(
  cityIds: string[],
  places: PlaceRecord[],
  items: PlanItem[],
  stays: Pick<StayRecord, "cityId" | "checkIn" | "checkOut">[],
  travellers: number,
): CityFigures[] {
  const stops = active(items).filter((i) => i.status !== "skipped");
  return cityIds.map((cityId) => {
    const own = places.filter((p) => p.cityId === cityId);
    const ownIds = new Set(own.map((p) => p.id));
    const byId = new Map(own.map((p) => [p.id, p]));
    const cityStops = stops.filter((i) => ownIds.has(i.placeId));
    return {
      cityId,
      places: own.length,
      inPlan: new Set(cityStops.map((i) => i.placeId)).size,
      estimateYen: cityStops.reduce(
        (total, i) =>
          total + (byId.get(i.placeId)?.costEstimateJPY ?? 0) * travellers,
        0,
      ),
      nights: stays
        .filter((s) => s.cityId === cityId)
        .reduce((total, s) => total + nightsBetween(s.checkIn, s.checkOut), 0),
    };
  });
}

export type RouteLeg = { cityId: string; days: number };

// The trip as one line of consecutive cities. A transfer day counts for the
// city you arrive at.
export function routeLegs(days: TripDay[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (const day of days) {
    const cityId = day.cityIds.at(-1);
    if (!cityId) continue;
    const last = legs.at(-1);
    if (last?.cityId === cityId) last.days += 1;
    else legs.push({ cityId, days: 1 });
  }
  return legs;
}

// The next booking from today on.
export function nextReservation<R extends Pick<ReservationRecord, "date">>(
  reservations: R[],
  today: string,
): R | null {
  return reservations.find((r) => r.date >= today) ?? null;
}

// The hotel for tonight: where you sleep, not the one you left this morning.
export function stayTonight<S extends Pick<StayRecord, "checkIn" | "checkOut">>(
  stays: S[],
  today: string,
): S | null {
  return stays.find((s) => s.checkIn <= today && today < s.checkOut) ?? null;
}

export type ClosedStop = { item: PlanItem; place: PlaceRecord };

// Stops still to come on a date their place says it's closed.
export function stopsOnClosedDays(
  items: PlanItem[],
  placesById: ReadonlyMap<string, PlaceRecord>,
  today: string,
): ClosedStop[] {
  return items.flatMap((item) => {
    if (item.status !== "planned" || item.date < today) return [];
    const place = placesById.get(item.placeId);
    return place?.closedDates.includes(item.date) ? [{ item, place }] : [];
  });
}

export function upcomingHolidays(
  holidays: HolidayRecord[],
  today: string,
  limit = 3,
): HolidayRecord[] {
  return holidays
    .filter((h) => h.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, limit);
}

// Days of the trip with no hotel for that night. The last day needs none.
export function nightsWithoutHotel(
  days: TripDay[],
  stays: Pick<StayRecord, "checkIn" | "checkOut">[],
): string[] {
  return days
    .slice(0, -1)
    .filter(
      (d) => !stays.some((s) => s.checkIn <= d.date && d.date < s.checkOut),
    )
    .map((d) => d.date);
}

export function placesToResearch(places: PlaceRecord[]): number {
  return places.filter((p) => isDraft(p) || needsResearch(p)).length;
}
