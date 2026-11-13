import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLOR,
  EXPENSE_COLOR,
  PRIORITY_COLOR,
} from "@/domain/taxonomy";
import { PALETTES } from "./palette";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

// The block of declarations that follows a selector.
function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("\n}", start));
}

const SELECTORS = PALETTES.flatMap((palette) =>
  palette === "sen"
    ? [":root", ".dark"]
    : [
        `:root[data-palette="${palette}"]`,
        `:root[data-palette="${palette}"].dark`,
      ],
);

// Every token the taxonomy points at, plus the map pins.
const TOKENS = [
  ...Object.values(CATEGORY_COLOR),
  ...Object.values(PRIORITY_COLOR),
  ...Object.values(EXPENSE_COLOR),
  "var(--pin-stop)",
  "var(--pin-finished)",
  "var(--pin-hotel)",
].map((value) => value.replace(/^var\((--[\w-]+)\)$/, "$1"));

describe("colour tokens", () => {
  it("point at custom properties, never fixed colours", () => {
    for (const token of TOKENS) expect(token).toMatch(/^--[\w-]+$/);
  });

  it.each(SELECTORS)(
    "%s defines every category, priority, spending and pin token",
    (selector) => {
      const body = block(selector);
      for (const token of TOKENS)
        expect(body, `${selector} ${token}`).toMatch(
          new RegExp(String.raw`\n\s+${token}:\s*[^;]+;`),
        );
    },
  );

  it("covers all four colour families in light and dark", () => {
    expect(SELECTORS).toHaveLength(8);
  });
});
