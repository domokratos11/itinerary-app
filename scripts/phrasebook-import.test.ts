import { existsSync, readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SOURCE,
  importPhrasebook,
  SHOW_TO_STAFF,
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

describe("SHOW_TO_STAFF", () => {
  // The guide's markup for a phrase card, a word-list row, a topic button
  // and the quiz, as its own code renders them.
  const MAIN = `
<p class="lede">Pick a situation.</p>
<button class="topic"><span class="jp" lang="ja">基本</span></button>
<article class="card"><div class="head"><button class="ib say" data-say="すみません">L</button></div>
<div class="jp" lang="ja">すみません</div><div class="kana" lang="ja">すみません</div><div class="ro">sumimasen</div><div class="mean">Excuse me</div>
<div class="sub"><div class="row"><div class="tx"><div class="jp" lang="ja">袋はいりません</div><div class="kana" lang="ja">ふくろはいりません</div><div class="ro">fukuro wa irimasen</div><div class="mean">No bag, thanks</div></div></div></div>
</article>
<table><tr><td class="j" lang="ja">切符</td><td><span lang="ja">きっぷ</span><br><i class="ro">kippu</i></td><td><span class="mean">Ticket</span></td></tr></table>
<div class="quiz"><div class="head"><div class="big" lang="ja">お会計</div></div></div>`;

  const added: [string, EventListener][] = [];
  afterEach(() => {
    for (const [type, fn] of added.splice(0)) {
      document.removeEventListener(type, fn);
    }
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    document.documentElement.className = "";
  });

  // Runs the injected script on that markup, framed by the app unless
  // `standalone`, with or without speech.
  function guide({ standalone = false, speech = true } = {}) {
    document.body.innerHTML = `<header class="top"><button id="back">Back</button></header><main class="wrap" id="main">${MAIN}</main>`;
    const add = document.addEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation(
      (type: string, fn: EventListenerOrEventListenerObject) => {
        added.push([type, fn as EventListener]);
        add(type, fn);
      },
    );
    const postMessage = vi.fn();
    const speak = vi.fn();
    const win: Record<string, unknown> = {
      location: { origin: "http://localhost:3000" },
      getSelection: () => window.getSelection(),
      addEventListener() {},
      MutationObserver,
    };
    win.parent = standalone ? win : { postMessage };
    if (speech) {
      win.speechSynthesis = { cancel() {}, speak };
      win.SpeechSynthesisUtterance = class {
        lang = "";
        rate = 1;
        constructor(public text: string) {}
      };
    }
    new Function("window", "document", SHOW_TO_STAFF)(win, document);
    return { postMessage, speak };
  }

  function click(el: Element | null) {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function key(target: Element | Document, value: string) {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: value, bubbles: true }),
    );
  }

  const overlay = () => document.querySelector<HTMLElement>(".tp-staff");

  it("shows a tapped phrase full screen, with its kana and meaning", () => {
    const { postMessage } = guide();
    click(document.querySelectorAll(".card .jp")[1]);
    const box = overlay();
    expect(box).toHaveAttribute("role", "dialog");
    expect(box).toHaveAttribute("aria-modal", "true");
    expect(box).toBeVisible();
    expect(box?.querySelector(".tp-staff-jp")).toHaveTextContent(
      "袋はいりません",
    );
    expect(box?.querySelector(".tp-staff-jp")).toHaveAttribute("lang", "ja");
    expect(box?.querySelector(".tp-staff-kana")).toHaveTextContent(
      "ふくろはいりません",
    );
    expect(box?.querySelector(".tp-staff-mean")).toHaveTextContent(
      "No bag, thanks",
    );
    expect(document.activeElement).toHaveTextContent("Close");
    expect(document.querySelector("header")).toHaveAttribute("inert");
    expect(document.documentElement).toHaveClass("tp-staff-on");
    expect(postMessage).toHaveBeenCalledWith(
      { type: "trip-planner:phrasebook-fullscreen", open: true },
      "http://localhost:3000",
    );
  });

  it("skips kana that only repeats the phrase", () => {
    guide();
    click(document.querySelector(".card > .jp"));
    expect(overlay()?.querySelector(".tp-staff-kana")).not.toBeVisible();
  });

  it("closes on Escape and gives focus back to the phrase", () => {
    const { postMessage } = guide();
    const phrase = document.querySelector<HTMLElement>(".card > .jp");
    phrase?.focus();
    click(phrase);
    key(document, "Escape");
    expect(overlay()).not.toBeVisible();
    expect(document.activeElement).toBe(phrase);
    expect(document.querySelector("header")).not.toHaveAttribute("inert");
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: "trip-planner:phrasebook-fullscreen", open: false },
      "http://localhost:3000",
    );
  });

  it("closes from its button and on a tap on the text", () => {
    guide();
    click(document.querySelector(".card > .jp"));
    click(overlay()?.querySelector(".tp-staff-close") ?? null);
    expect(overlay()).not.toBeVisible();
    click(document.querySelector(".card > .jp"));
    click(overlay()?.querySelector(".tp-staff-jp") ?? null);
    expect(overlay()).not.toBeVisible();
  });

  it("reads the phrase aloud without closing", () => {
    const { speak } = guide();
    click(document.querySelector(".card > .jp"));
    click(overlay()?.querySelector(".tp-staff-say") ?? null);
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "すみません",
        lang: "ja-JP",
        rate: 0.85,
      }),
    );
    expect(overlay()).toBeVisible();
  });

  it("hides Listen without speech", () => {
    guide({ speech: false });
    click(document.querySelector(".card > .jp"));
    expect(overlay()?.querySelector(".tp-staff-say")).not.toBeVisible();
  });

  it("takes a word-list entry's kana and meaning from its row", () => {
    guide();
    click(document.querySelector("td.j"));
    expect(overlay()?.querySelector(".tp-staff-jp")).toHaveTextContent("切符");
    expect(overlay()?.querySelector(".tp-staff-kana")).toHaveTextContent(
      "きっぷ",
    );
    expect(overlay()?.querySelector(".tp-staff-mean")).toHaveTextContent(
      "Ticket",
    );
  });

  it("shows the quiz phrase without giving the answer away", () => {
    guide();
    click(document.querySelector(".big"));
    expect(overlay()?.querySelector(".tp-staff-jp")).toHaveTextContent(
      "お会計",
    );
    expect(overlay()?.querySelector(".tp-staff-mean")).not.toBeVisible();
  });

  it("leaves Japanese inside the guide's buttons to the guide", () => {
    guide();
    click(document.querySelector(".topic .jp"));
    expect(overlay()).toBeNull();
    expect(document.querySelector(".topic .jp")).not.toHaveAttribute(
      "tabindex",
    );
  });

  it("makes each phrase reachable from the keyboard", () => {
    guide();
    const phrase = document.querySelector(".card > .jp");
    expect(phrase).toHaveAttribute("tabindex", "0");
    expect(phrase).toHaveAttribute("role", "button");
    expect(document.querySelector("td.j")).not.toHaveAttribute("role");
    if (phrase) key(phrase, "Enter");
    expect(overlay()).toBeVisible();
  });

  it("tells no one when it isn't framed", () => {
    const { postMessage } = guide({ standalone: true });
    click(document.querySelector(".card > .jp"));
    expect(overlay()).toBeVisible();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("is valid script and goes in with its styles", () => {
    expect(() => new Function(SHOW_TO_STAFF)).not.toThrow();
    const html = importPhrasebook(GUIDE);
    expect(html).toContain(`<script>${SHOW_TO_STAFF}</script>`);
    expect(html).toContain(".tp-staff{position:fixed;inset:0;");
    expect(html).toContain('.lede::after{content:"Tap any Japanese text');
    expect(html.indexOf("tp-staff{")).toBeLessThan(html.indexOf("</style>"));
  });
});
