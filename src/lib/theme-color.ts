// The page background of each theme, as in globals.css (--background). The
// browser paints its own bar in this colour, so it has to follow the theme.
export const THEME_COLOR = {
  light: "#f4f6fa",
  dark: "#0d1220",
} as const;

// Points <meta name="theme-color"> at the given theme, adding the tag if the
// page has none.
export function applyThemeColor(theme: string | undefined): void {
  const color = theme === "dark" ? THEME_COLOR.dark : THEME_COLOR.light;
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
