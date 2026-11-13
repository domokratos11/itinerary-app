import type { Category, ExpenseCategory, Priority } from "./schemas";

// One colour per category and priority, used by badges, filters, charts and
// map pins alike. They are theme tokens (`--cat-*`, `--prio-*`, `--exp-*` in
// globals.css): the same hue in every colour family, tuned in lightness and
// chroma to each family and to light or dark. Icons are in lib/taxonomy-icons.
export const CATEGORY_COLOR: Record<Category, string> = {
  lights: "var(--cat-lights)",
  food: "var(--cat-food)",
  shopping: "var(--cat-shopping)",
  sight: "var(--cat-sight)",
  daytrip: "var(--cat-daytrip)",
  temple: "var(--cat-temple)",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  must: "var(--prio-must)",
  want: "var(--prio-want)",
  maybe: "var(--prio-maybe)",
};

// Spending categories, in a fixed order that keeps neighbouring slices apart
// for colour-blind readers. Every chart also labels them, with an icon.
export const EXPENSE_COLOR: Record<ExpenseCategory, string> = {
  flight: "var(--exp-flight)",
  booking: "var(--exp-booking)",
  transport: "var(--exp-transport)",
  food: "var(--exp-food)",
  souvenirs: "var(--exp-souvenirs)",
  attractions: "var(--exp-attractions)",
  clothes: "var(--exp-clothes)",
  temples: "var(--exp-temples)",
  other: "var(--exp-other)",
};

// A colour mixed into the card behind it, so text stays readable on any city
// colour, in light and dark.
export function tint(color: string, percent = 18): string {
  return `color-mix(in oklab, ${color} ${percent}%, var(--card))`;
}
