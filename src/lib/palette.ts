import { create } from "zustand";

// The colour family of this device, on top of Light and Dark (next-themes).
// Sen is the default and has no data-palette attribute; the others are
// `:root[data-palette="..."]` blocks in globals.css.
export const PALETTES = ["sen", "ink", "pine", "plum"] as const;
export type Palette = (typeof PALETTES)[number];

const KEY = "palette";

function isPalette(value: unknown): value is Palette {
  return PALETTES.includes(value as Palette);
}

export function getPalette(): Palette {
  if (typeof window === "undefined") return "sen";
  try {
    const stored = window.localStorage.getItem(KEY);
    return isPalette(stored) ? stored : "sen";
  } catch {
    return "sen";
  }
}

function applyAttribute(palette: Palette): void {
  if (typeof document === "undefined") return;
  if (palette === "sen") delete document.documentElement.dataset.palette;
  else document.documentElement.dataset.palette = palette;
}

const usePaletteStore = create<{ palette: Palette }>()(() => ({
  palette: getPalette(),
}));

// Shows the saved palette on the page; run once on mount.
export function applyPalette(): void {
  const palette = getPalette();
  applyAttribute(palette);
  usePaletteStore.setState({ palette });
}

export function setPalette(palette: Palette): void {
  usePaletteStore.setState({ palette });
  applyAttribute(palette);
  try {
    window.localStorage.setItem(KEY, palette);
  } catch {
    // Blocked storage: it stays as chosen until the page reloads.
  }
}

export function usePalette(): Palette {
  return usePaletteStore((s) => s.palette);
}
