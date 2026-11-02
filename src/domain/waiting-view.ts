import {
  PRIORITIES,
  type Category,
  type Place,
  type Priority,
} from "./schemas";

export const WAITING_SORTS = ["priority", "name-asc", "name-desc"] as const;

export type WaitingSort = (typeof WAITING_SORTS)[number];

// How the places waiting on a day's page are listed and pinned.
export type WaitingView = {
  sort: WaitingSort;
  category: Category | "all";
  priority: Priority | "all";
};

export const DEFAULT_WAITING_VIEW: WaitingView = {
  sort: "priority",
  category: "all",
  priority: "all",
};

export function isDefaultWaitingView(view: WaitingView): boolean {
  return (
    view.sort === DEFAULT_WAITING_VIEW.sort &&
    view.category === DEFAULT_WAITING_VIEW.category &&
    view.priority === DEFAULT_WAITING_VIEW.priority
  );
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

// The places this view shows, in its order. Must-sees come first by default,
// with names settling ties so the list doesn't shuffle between visits.
export function applyWaitingView<
  P extends Pick<Place, "name" | "category" | "priority">,
>(places: P[], view: WaitingView): P[] {
  const shown = places.filter(
    (p) =>
      (view.category === "all" || p.category === view.category) &&
      (view.priority === "all" || p.priority === view.priority),
  );
  if (view.sort === "name-asc") return shown.sort(byName);
  if (view.sort === "name-desc") return shown.sort((a, b) => byName(b, a));
  const rank = (p: P) => PRIORITIES.indexOf(p.priority);
  return shown.sort((a, b) => rank(a) - rank(b) || byName(a, b));
}
