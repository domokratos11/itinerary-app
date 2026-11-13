"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t } from "@/lib/i18n";
import { PALETTES, setPalette, usePalette, type Palette } from "@/lib/palette";

// A family's primary colour, as in globals.css, for its swatch. Fixed, so each
// option shows its own colours whichever palette is active.
const SWATCH: Record<Palette, string> = {
  sen: "#2b47a8",
  ink: "#1d2228",
  pine: "#1f5f4b",
  plum: "#8c2f5e",
};

const NAME = {
  sen: "theme.paletteSen",
  ink: "theme.paletteInk",
  pine: "theme.palettePine",
  plum: "theme.palettePlum",
} as const;

// Picks the colour family of this device: two by two on a phone, one row from
// lg. It sits beside the Light/Dark button, which picks the mode.
export function PalettePicker() {
  const palette = usePalette();
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={palette}
      // Clicking the chosen option again would clear it; one always stays on.
      onValueChange={(value) => {
        if (PALETTES.includes(value as Palette)) setPalette(value as Palette);
      }}
      aria-label={t("theme.palette")}
      className="grid w-full grid-cols-2 gap-2 lg:grid-cols-4"
    >
      {PALETTES.map((id) => (
        <ToggleGroupItem
          key={id}
          value={id}
          aria-label={t(NAME[id])}
          className="justify-start gap-2"
        >
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: SWATCH[id] }}
          />
          {t(NAME[id])}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
