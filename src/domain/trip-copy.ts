import { addDays, toUtcDate } from "./days";
import type {
  Budget,
  FlightRecord,
  PlanItem,
  ReservationRecord,
  StayRecord,
  TodoRecord,
} from "./schemas";
import { tripDatesOf } from "./schemas";
import type { TripData } from "./trip";
import type { TripSummary } from "./trip-repository";

// Copying parts of another itinerary into a new one, as pure logic. The
// source is only read; this returns what to write into the target. Nothing
// here is worded: the copy panel words the report.

export const COPY_PARTS = [
  "cities",
  "places",
  "hotels",
  "flights",
  "bookings",
  "plan",
  "budget",
  "todos",
  "holidays",
  "members",
] as const;

export type CopyPart = (typeof COPY_PARTS)[number];

// A part needs the ones it points at: places and hotels sit in a city, a
// stop is a visit to a place.
const NEEDS: Partial<Record<CopyPart, CopyPart[]>> = {
  places: ["cities"],
  hotels: ["cities"],
  plan: ["places"],
};

// The parts chosen plus everything they need, in COPY_PARTS order.
export function withNeeds(parts: Iterable<CopyPart>): CopyPart[] {
  const chosen = new Set<CopyPart>();
  const add = (part: CopyPart) => {
    if (chosen.has(part)) return;
    chosen.add(part);
    for (const need of NEEDS[part] ?? []) add(need);
  };
  for (const part of parts) add(part);
  return COPY_PARTS.filter((part) => chosen.has(part));
}

// The parts that need this one, directly or not, so unticking it unticks
// them too.
export function neededBy(part: CopyPart): CopyPart[] {
  return COPY_PARTS.filter(
    (other) => other !== part && withNeeds([other]).includes(part),
  );
}

// Every part this one needs, directly or not.
export function needsOf(part: CopyPart): CopyPart[] {
  return withNeeds([part]).filter((other) => other !== part);
}

export type CopySource = {
  summary: Pick<TripSummary, "name" | "members"> &
    Partial<Pick<TripSummary, "startDate" | "budget">>;
  data: TripData;
  items: PlanItem[];
};

// Without dates of its own nothing moves and nothing is outside them.
export type CopyTarget = {
  startDate?: string | null;
  endDate?: string | null;
  members: string[];
  budget?: Budget | null;
  // The person copying: always stays on the member list.
  me: string;
};

// The most people a trip's member list holds (firestore.rules).
export const MAX_MEMBERS = 20;

// A copied record that lands outside the target's dates. It is still
// copied; the person can fix it afterwards.
export type OutsideRecord = {
  part: "hotels" | "flights" | "bookings" | "plan";
  id: string;
  date: string;
  // The hotel, flight number or place; a booking has its type instead.
  name: string | null;
  reservationType?: ReservationRecord["type"];
};

export type CopyReport = {
  // The parts copied, with what they needed.
  parts: CopyPart[];
  // Days added to every copied date.
  shift: number;
  // Records per part. Budget is 1 when copied; members counts the emails
  // added; todos counts the to-dos, `lists` their lists.
  counts: Record<CopyPart, number>;
  lists: number;
  // Emails left out because the list would pass MAX_MEMBERS.
  membersLeftOut: number;
  outside: OutsideRecord[];
};

export type TripCopy = {
  records: TripData;
  items: PlanItem[];
  changes: { budget?: Budget; members?: string[] };
  report: CopyReport;
};

function daysBetween(from: string, to: string): number {
  return Math.round(
    (toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000,
  );
}

// The source's first day: its own start date, or (for a trip made before
// trips had dates) its earliest active check-in. Null when it has neither.
export function sourceFirstDay(source: CopySource): string | null {
  if (source.summary.startDate) return source.summary.startDate;
  const checkIns = source.data.stays
    .filter((s) => !s.archived)
    .map((s) => s.checkIn)
    .sort();
  return checkIns[0] ?? null;
}

// How many days every copied date moves: from the source's first day to the
// target's start. Zero when the source has no first day.
export function copyShift(
  source: CopySource,
  targetStart: string | null,
): number {
  const first = sourceFirstDay(source);
  return first && targetStart ? daysBetween(first, targetStart) : 0;
}

// The parts worth offering: those with something to copy. Holidays belong
// to their dates, so they are offered only when nothing moves.
export function availableParts(
  source: CopySource,
  target: CopyTarget,
): CopyPart[] {
  const { report } = copyTrip(source, COPY_PARTS, target);
  return COPY_PARTS.filter(
    (part) =>
      (report.counts[part] > 0 || (part === "todos" && report.lists > 0)) &&
      (part !== "holidays" || report.shift === 0),
  );
}

function emailsOf(list: string[]): string[] {
  return list.map((email) => email.trim().toLowerCase()).filter(Boolean);
}

// An ID that holds the record's old date (the app makes stay, flight and
// booking IDs from them, e.g. `kyoto-2026-12-17`) gets the new date, as a
// new record would; any other ID is kept. A clash gets a number.
function movedId(
  id: string,
  oldDate: string,
  newDate: string,
  taken: Set<string>,
): string {
  let next = oldDate !== newDate ? id.split(oldDate).join(newDate) : id;
  if (taken.has(next)) {
    const base = next.slice(0, 60);
    for (let n = 2; taken.has(next); n++) next = `${base}-${n}`;
  }
  taken.add(next);
  return next;
}

const outsideRange = (date: string, start: string, end: string) =>
  date < start || date > end;

// What to write into the target for these choices. Only active records are
// copied (never archived or removed ones), and never expenses, cash,
// activity, share links, proposals or day research. Dated records move by
// the shift; records keep their IDs unless the ID holds a date that moved.
export function copyTrip(
  source: CopySource,
  choices: Iterable<CopyPart>,
  target: CopyTarget,
  now: Date = new Date(),
): TripCopy {
  const range = tripDatesOf(target);
  const shift = copyShift(source, range?.startDate ?? null);
  const parts = withNeeds(choices).filter(
    (part) => part !== "holidays" || shift === 0,
  );
  const chosen = new Set(parts);
  const updatedAt = now.toISOString();
  const move = (date: string) => addDays(date, shift);
  const fresh = { archived: false, updatedAt };
  const { data } = source;
  const records: TripData = {
    cities: [],
    stays: [],
    reservations: [],
    places: [],
    holidays: [],
    expenses: [],
    flights: [],
    cash: [],
    todoLists: [],
    todos: [],
  };
  const outside: OutsideRecord[] = [];
  const isOutside = (date: string) =>
    range !== null && outsideRange(date, range.startDate, range.endDate);

  if (chosen.has("cities"))
    records.cities = data.cities
      .filter((c) => !c.archived)
      .map((c) => ({ ...c, ...fresh }));
  const cityIds = new Set(records.cities.map((c) => c.id));

  // The catalogue as it is, Google fields included: locationFetchedAt keeps
  // the first fetch, so the 30-day limit keeps counting from it.
  if (chosen.has("places"))
    records.places = data.places
      .filter((p) => !p.archived && cityIds.has(p.cityId))
      .map((p) => ({ ...p, ...fresh }));
  const places = new Map(records.places.map((p) => [p.id, p]));

  if (chosen.has("hotels")) {
    const taken = new Set<string>();
    records.stays = data.stays
      .filter((s) => !s.archived && cityIds.has(s.cityId))
      .map((s): StayRecord => {
        const checkIn = move(s.checkIn);
        const checkOut = move(s.checkOut);
        const id = movedId(s.id, s.checkIn, checkIn, taken);
        if (isOutside(checkIn) || isOutside(checkOut))
          outside.push({
            part: "hotels",
            id,
            date: checkIn,
            name: s.hotelName,
          });
        return { ...s, id, checkIn, checkOut, note: null, ...fresh };
      });
  }

  if (chosen.has("flights")) {
    const taken = new Set<string>();
    records.flights = data.flights
      .filter((f) => !f.archived)
      .map((f): FlightRecord => {
        const departDate = move(f.departDate);
        const arriveDate = move(f.arriveDate);
        const id = movedId(f.id, f.departDate, departDate, taken);
        // A flight that doesn't touch the trip at all: arriving the day
        // before it starts is normal.
        if (
          range !== null &&
          (arriveDate < range.startDate || departDate > range.endDate)
        )
          outside.push({
            part: "flights",
            id,
            date: departDate,
            name: f.flightNumber,
          });
        return {
          ...f,
          id,
          departDate,
          arriveDate,
          confirmation: null,
          costAmount: null,
          note: null,
          ...fresh,
        };
      });
  }

  // Bookings without their notes; the expenses they link to stay behind.
  if (chosen.has("bookings")) {
    const taken = new Set<string>();
    records.reservations = data.reservations
      .filter((r) => !r.archived)
      .map((r): ReservationRecord => {
        const date = move(r.date);
        const id = movedId(r.id, r.date, date, taken);
        if (isOutside(date))
          outside.push({
            part: "bookings",
            id,
            date,
            name: r.venue ?? r.to ?? r.from,
            reservationType: r.type,
          });
        return { ...r, id, date, note: null, ...fresh };
      });
  }

  let items: PlanItem[] = [];
  if (chosen.has("plan"))
    items = source.items
      .filter((item) => item.status !== "removed" && places.has(item.placeId))
      .map((item): PlanItem => {
        const date = move(item.date);
        if (isOutside(date))
          outside.push({
            part: "plan",
            id: item.id,
            date,
            name: places.get(item.placeId)?.name ?? null,
          });
        return { ...item, date, status: "planned", updatedAt };
      });

  if (chosen.has("holidays"))
    records.holidays = data.holidays
      .filter((h) => !h.archived)
      .map((h) => ({ ...h, ...fresh }));

  // Members: the target's list first (with the person copying), then the
  // source's, up to the limit.
  const me = target.me.trim().toLowerCase();
  const before = [...new Set([me, ...emailsOf(target.members)])];
  let members = before;
  let membersLeftOut = 0;
  if (chosen.has("members")) {
    const all = [...new Set([...before, ...emailsOf(source.summary.members)])];
    members = all.slice(0, MAX_MEMBERS);
    membersLeftOut = all.length - members.length;
  }
  const onList = new Set(members);

  if (chosen.has("todos")) {
    records.todoLists = data.todoLists
      .filter((l) => !l.archived)
      .map((l) => ({ ...l, ...fresh }));
    const listIds = new Set(records.todoLists.map((l) => l.id));
    records.todos = data.todos
      .filter((todo) => !todo.archived && listIds.has(todo.listId))
      .map((todo): TodoRecord => ({
        ...todo,
        status: "todo",
        completedAt: null,
        assignee:
          chosen.has("members") && todo.assignee && onList.has(todo.assignee)
            ? todo.assignee
            : null,
        dueDate: todo.dueDate && move(todo.dueDate),
        ...fresh,
      }));
  }

  const changes: TripCopy["changes"] = {};
  const sourceBudget = source.summary.budget ?? null;
  const hasBudget =
    sourceBudget !== null &&
    (sourceBudget.totalJPY !== null ||
      sourceBudget.travellers !== null ||
      Object.keys(sourceBudget.byCategory).length > 0);
  if (chosen.has("budget") && hasBudget) {
    // Per-member targets only come along with the members they belong to.
    const byMember = chosen.has("members")
      ? Object.fromEntries(
          Object.entries(sourceBudget.byMember ?? {}).filter(([email]) =>
            onList.has(email),
          ),
        )
      : (target.budget?.byMember ?? {});
    changes.budget = {
      totalJPY: sourceBudget.totalJPY,
      byCategory: { ...sourceBudget.byCategory },
      travellers: sourceBudget.travellers,
      byMember,
    };
  }
  const added = members.length - before.length;
  if (chosen.has("members") && added > 0) changes.members = members;

  const counts: Record<CopyPart, number> = {
    cities: records.cities.length,
    places: records.places.length,
    hotels: records.stays.length,
    flights: records.flights.length,
    bookings: records.reservations.length,
    plan: items.length,
    budget: changes.budget ? 1 : 0,
    todos: records.todos.length,
    holidays: records.holidays.length,
    members: added,
  };
  outside.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    records,
    items,
    changes,
    report: {
      parts,
      shift,
      counts,
      lists: records.todoLists.length,
      membersLeftOut,
      outside,
    },
  };
}

// Whether a report has anything to write.
export function copiesAnything(report: CopyReport): boolean {
  return COPY_PARTS.some((part) => report.counts[part] > 0) || report.lists > 0;
}
