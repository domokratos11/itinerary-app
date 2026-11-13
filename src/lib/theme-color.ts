import type { Palette } from "@/lib/palette";

// The page background of each palette in light and dark, as in globals.css
// (--background). The browser paints its own bar in this colour, so it has to
// follow the theme.
const BACKGROUNDS = {
  sen: { light: "#f4f6fa", dark: "#0d1220" },
  ink: { light: "#f3f4f6", dark: "#101214" },
  pine: { light: "#f4f3ee", dark: "#0d1412" },
  plum: { light: "#f7f3f5", dark: "#151017" },
} as const satisfies Record<Palette, { light: string; dark: string }>;

// The default palette (Sen), for the static manifest and viewport.
export const THEME_COLOR = BACKGROUNDS.sen;

// Points <meta name="theme-color"> at the given theme and palette, adding the
// tag if the page has none.
export function applyThemeColor(
  theme: string | undefined,
  palette: Palette = "sen",
): void {
  const colors = BACKGROUNDS[palette] ?? BACKGROUNDS.sen;
  const color = theme === "dark" ? colors.dark : colors.light;
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}
