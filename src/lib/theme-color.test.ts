import { afterEach, describe, expect, it } from "vitest";

import { applyThemeColor, THEME_COLOR } from "@/lib/theme-color";

const meta = () =>
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

describe("applyThemeColor", () => {
  afterEach(() => {
    meta()?.remove();
  });

  it("adds the tag when the page has none", () => {
    applyThemeColor("dark");
    expect(meta()?.content).toBe(THEME_COLOR.dark);
  });

  it("changes the tag that is already there", () => {
    applyThemeColor("dark");
    applyThemeColor("light");
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(
      1,
    );
    expect(meta()?.content).toBe(THEME_COLOR.light);
  });

  it("uses the light colour until the theme is known", () => {
    applyThemeColor(undefined);
    expect(meta()?.content).toBe(THEME_COLOR.light);
  });
});
