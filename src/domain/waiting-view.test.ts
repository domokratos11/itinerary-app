import { describe, expect, it } from "vitest";

import {
  applyWaitingView,
  DEFAULT_WAITING_VIEW,
  isDefaultWaitingView,
} from "./waiting-view";
import type { Category, Priority } from "./schemas";

const place = (name: string, category: Category, priority: Priority) => ({
  name,
  category,
  priority,
});

const places = [
  place("Zoo", "sight", "maybe"),
  place("ramen bar", "food", "must"),
  place("Arcade", "shopping", "want"),
  place("Aquarium", "sight", "must"),
];

const names = (list: { name: string }[]) => list.map((p) => p.name);

describe("applyWaitingView", () => {
  it("lists must-sees first by default, then by name", () => {
    expect(names(applyWaitingView(places, DEFAULT_WAITING_VIEW))).toEqual([
      "Aquarium",
      "ramen bar",
      "Arcade",
      "Zoo",
    ]);
  });

  it("sorts by name either way, ignoring capitals", () => {
    const view = { ...DEFAULT_WAITING_VIEW, sort: "name-asc" as const };
    expect(names(applyWaitingView(places, view))).toEqual([
      "Aquarium",
      "Arcade",
      "ramen bar",
      "Zoo",
    ]);
    expect(
      names(applyWaitingView(places, { ...view, sort: "name-desc" })),
    ).toEqual(["Zoo", "ramen bar", "Arcade", "Aquarium"]);
  });

  it("filters by category and priority, together", () => {
    expect(
      names(
        applyWaitingView(places, {
          ...DEFAULT_WAITING_VIEW,
          category: "sight",
        }),
      ),
    ).toEqual(["Aquarium", "Zoo"]);
    expect(
      names(
        applyWaitingView(places, {
          ...DEFAULT_WAITING_VIEW,
          category: "sight",
          priority: "must",
        }),
      ),
    ).toEqual(["Aquarium"]);
    expect(
      applyWaitingView(places, {
        ...DEFAULT_WAITING_VIEW,
        category: "temple",
      }),
    ).toEqual([]);
  });

  it("leaves the list it was given as it was", () => {
    const before = [...places];
    applyWaitingView(places, { ...DEFAULT_WAITING_VIEW, sort: "name-desc" });
    expect(places).toEqual(before);
  });
});

describe("isDefaultWaitingView", () => {
  it("knows when there's nothing to clear", () => {
    expect(isDefaultWaitingView(DEFAULT_WAITING_VIEW)).toBe(true);
    expect(
      isDefaultWaitingView({ ...DEFAULT_WAITING_VIEW, sort: "name-asc" }),
    ).toBe(false);
    expect(
      isDefaultWaitingView({ ...DEFAULT_WAITING_VIEW, category: "food" }),
    ).toBe(false);
    expect(
      isDefaultWaitingView({ ...DEFAULT_WAITING_VIEW, priority: "must" }),
    ).toBe(false);
  });
});
