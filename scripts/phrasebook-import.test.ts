import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SOURCE,
  importPhrasebook,
  stripPhrasebook,
  THEME_SYNC,
} from "./phrasebook-import";

// The parts of the guide's template the import relies on.
const GUIDE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Japanese Trip Phrasebook</title>
<style>
:root{--bg:#eef2f7;--ink:#16233a;--muted:#5b6b84}
</style>
</head>
<body>
<header class="top"><div class="top-in">
  <div class="bar">
    <button class="back" id="back" aria-label="Back to topics">&#8249;</button>
  </div>
</div></header>
<main class="wrap" id="main"></main>
<script>const DATA = [];</script>
</body>
</html>
`;

describe("importPhrasebook", () => {
  it("adds the link home, the manifest, the theme colour and the worker", () => {
    const html = importPhrasebook(GUIDE);
    expect(html).toContain(
      '<a class="trip-home" href="/itinerary-app/">&#8592; Trip Planner</a>',
    );
    expect(html).toContain(
      '<link rel="manifest" href="/itinerary-app/manifest.webmanifest">',
    );
    expect(html).toMatch(/<meta name="theme-color" [^>]*content="#/);
    expect(html).toContain(".trip-home{");
    expect(html).toContain("min-height:44px");
    expect(html).toContain("register('/itinerary-app/sw.js'");
  });

  it("puts the link before the bar, so the guide's own back button is untouched", () => {
    const html = importPhrasebook(GUIDE);
    expect(html.indexOf('trip-home" href')).toBeLessThan(
      html.indexOf('<div class="bar">'),
    );
    expect(html).toContain(
      '<button class="back" id="back" aria-label="Back to topics">&#8249;</button>',
    );
  });

  // An HTML comment inside <style> is CSS text and would swallow the rule.
  it("marks the CSS block with CSS comments only", () => {
    const html = importPhrasebook(GUIDE);
    const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(style).not.toContain("<!--");
    expect(style).toContain("/* trip-planner:start */\n.trip-home{");
  });

  it("gives the same file when run twice or on its own output", () => {
    const once = importPhrasebook(GUIDE);
    expect(importPhrasebook(GUIDE)).toBe(once);
    expect(importPhrasebook(once)).toBe(once);
  });

  it("leaves every other byte of the guide unchanged", () => {
    expect(stripPhrasebook(importPhrasebook(GUIDE))).toBe(GUIDE);
  });

  it.each([
    ['<div class="top-in">', '<div class="top-in">'],
    ["</style>", "</style>"],
    ["</body>", "</body>"],
    [
      "viewport meta",
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
    ],
  ])("fails clearly when the %s anchor is missing", (name, anchor) => {
    expect(() => importPhrasebook(GUIDE.replace(anchor, ""))).toThrow(
      `anchor ${name} exactly once, found it 0 times`,
    );
  });

  it("fails when an anchor appears twice", () => {
    expect(() =>
      importPhrasebook(GUIDE.replace("</style>", "</style><style></style>")),
    ).toThrow("found it 2 times");
  });

  it.skipIf(!existsSync(DEFAULT_SOURCE))(
    "imports the real guide and keeps it intact",
    () => {
      const source = readFileSync(DEFAULT_SOURCE, "utf8");
      const html = importPhrasebook(source);
      expect(stripPhrasebook(html)).toBe(source);
      expect(importPhrasebook(html)).toBe(html);
    },
  );
});

describe("THEME_SYNC", () => {
  // Runs the injected script in a page framed by an "app" page.
  function framedGuide(appClass: string) {
    const app = document.implementation.createHTMLDocument("app");
    app.documentElement.className = appClass;
    app.documentElement.style.setProperty("--background", "#101010");
    app.documentElement.style.setProperty("--primary", "#abcdef");
    const parent = {
      document: app,
      getComputedStyle: (el: Element) => getComputedStyle(el),
    };
    const root = document.documentElement;
    root.removeAttribute("data-theme");
    root.className = "";
    root.removeAttribute("style");
    const run = new Function("window", "document", "localStorage", THEME_SYNC);
    run(
      { top: {}, self: {}, parent, MutationObserver, addEventListener() {} },
      document,
      localStorage,
    );
    return root;
  }

  it("copies the app's colours and light or dark when framed", () => {
    const root = framedGuide("dark");
    expect(root).toHaveClass("in-app");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.getPropertyValue("--bg")).toBe("#101010");
    expect(root.style.getPropertyValue("--accent")).toBe("#abcdef");
  });

  it("is valid script once injected", () => {
    const html = importPhrasebook(GUIDE);
    const script = html.match(
      /<script>(\(function\(\)\{[\s\S]*?\}\)\(\);)<\/script>/,
    );
    expect(script?.[1]).toBe(THEME_SYNC);
    expect(() => new Function(THEME_SYNC)).not.toThrow();
  });

  it("hides its own link home inside the app", () => {
    expect(importPhrasebook(GUIDE)).toContain(
      "html.in-app .trip-home{display:none}",
    );
  });
});
