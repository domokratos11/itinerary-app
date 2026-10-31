import type { TripDay } from "./days";
import type { PlanItem } from "./schemas";

// What is being dragged on the day page: a stop already in the plan, a
// or a draft place not yet planned.
export type DragSource =
  | { kind: "stop"; item: PlanItem; cityId: string | null }
  | { kind: "place"; placeId: string; cityId: string };

// Where it is dropped: on a stop of this day (before it), on the list's
// empty space (the end), or on another day's chip (the end of that day).
export type DropTarget =
  | { kind: "stop"; index: number }
  | { kind: "list" }
  | { kind: "day"; date: string };

export type DropPlan =
  | { kind: "none" }
  | { kind: "refuse"; reason: "not-a-day" | "city-not-on-day"; date: string }
  | { kind: "place"; date: string; index: number; cityId: string | null };

// `stops` is the current day's active stops in order; `dayLength` counts
// another day's active stops. The index is in that day's list without the
// dragged stop, which is what placeItem expects.
export function planDrop(
  source: DragSource,
  target: DropTarget,
  ctx: {
    date: string;
    stops: PlanItem[];
    days: TripDay[];
    dayLength: (date: string) => number;
  },
): DropPlan {
  const date = target.kind === "day" ? target.date : ctx.date;
  const day = ctx.days.find((d) => d.date === date);
  if (!day) return { kind: "refuse", reason: "not-a-day", date };

  const cityId = source.cityId;
  if (cityId !== null && !day.cityIds.includes(cityId))
    return { kind: "refuse", reason: "city-not-on-day", date };

  const isStop = source.kind === "stop";
  if (isStop && target.kind === "day" && source.item.date === date)
    return { kind: "none" };

  let index: number;
  if (target.kind === "day") index = ctx.dayLength(date);
  else if (target.kind === "list")
    index = isStop ? ctx.stops.length - 1 : ctx.stops.length;
  else index = target.index;

  if (isStop && target.kind !== "day") {
    const from = ctx.stops.findIndex((s) => s.id === source.item.id);
    if (from === index) return { kind: "none" };
  }
  return { kind: "place", date, index, cityId };
}
