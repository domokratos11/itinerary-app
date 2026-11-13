import type { MapPin } from "@/domain/maps-service";

// Google Maps draws pins itself, so it needs real colours, not `var(--x)`.
// This follows a theme token (`var(--cat-food)`, possibly pointing at another
// token) to the colour the page currently shows, so a pin matches the colour
// family and light or dark mode in use.
const VAR = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+?))?\s*\)$/;

export function resolveCssColor(
  value: string,
  root: HTMLElement | null = typeof document === "undefined"
    ? null
    : document.documentElement,
): string {
  if (!root) return value;
  const style = getComputedStyle(root);
  let current = value.trim();
  // A token may point at another token; five hops is far more than we use.
  for (let hop = 0; hop < 5; hop += 1) {
    const match = VAR.exec(current);
    if (!match) return current;
    const token = style.getPropertyValue(match[1]).trim();
    current = token || match[2]?.trim() || "";
    if (!current) return value;
  }
  return current;
}

// The pins with every colour resolved, so they can be drawn on a Google map.
export function resolvePinColors(pins: MapPin[]): MapPin[] {
  const seen = new Map<string, string>();
  return pins.map((pin) => {
    let color = seen.get(pin.color);
    if (color === undefined) {
      color = resolveCssColor(pin.color);
      seen.set(pin.color, color);
    }
    return { ...pin, color };
  });
}
