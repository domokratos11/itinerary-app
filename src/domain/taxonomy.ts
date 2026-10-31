import type { Category, ExpenseCategory, Priority } from "./schemas";

// One colour per category and priority, used by badges, filters, charts and
// map pins alike. Icons are in lib/taxonomy-icons.
export const CATEGORY_COLOR: Record<Category, string> = {
  lights: "#a855f7",
  food: "#92400e",
  shopping: "#db2777",
  sight: "#2563eb",
  daytrip: "#0d9488",
  temple: "#b91c1c",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  must: "#16a34a",
  want: "#eab308",
  maybe: "#f97316",
};

// Text that stays readable on a solid priority colour.
export const PRIORITY_INK: Record<Priority, string> = {
  must: "#ffffff",
  want: "#1c1917",
  maybe: "#1c1917",
};

// Spending categories, in a fixed order that keeps neighbouring slices apart
// for colour-blind readers. Every chart also labels them, with an icon.
export const EXPENSE_COLOR: Record<ExpenseCategory, string> = {
  flight: "#0891b2",
  booking: "#7c3aed",
  transport: "#65a30d",
  food: "#92400e",
  souvenirs: "#db2777",
  attractions: "#2563eb",
  clothes: "#0d9488",
  temples: "#b91c1c",
  other: "#78716c",
};

// Lighter steps for chart marks on the dark card, where the darkest colours
// above fall under 3:1.
export const DARK_STEP: Record<string, string> = {
  "#7c3aed": "#8b5cf6",
  "#92400e": "#b45309",
  "#2563eb": "#3b82f6",
  "#b91c1c": "#ef4444",
};

export function darkStep(color: string): string {
  return DARK_STEP[color] ?? color;
}

// A colour mixed into the card behind it, so text stays readable on any city
// colour, in light and dark.
export function tint(color: string, percent = 18): string {
  return `color-mix(in oklab, ${color} ${percent}%, var(--card))`;
}
