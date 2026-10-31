import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  browserLanguage,
  getLocale,
  initLocale,
  setLocale,
  t,
} from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

function leaves(node: object, prefix = ""): Record<string, string> {
  return Object.entries(node).reduce<Record<string, string>>(
    (all, [key, value]) =>
      typeof value === "string"
        ? { ...all, [`${prefix}${key}`]: value }
        : { ...all, ...leaves(value as object, `${prefix}${key}.`) },
    {},
  );
}

// The {names} a message needs, leaving out the words inside plural branches.
function argumentsOf(message: string): string[] {
  return [...message.matchAll(/\{(\w+)(?:,|\})/g)].map((m) => m[1]).sort();
}

describe("messages", () => {
  const english = leaves(en);
  const spanish = leaves(es);

  it("has the same keys in both languages", () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort());
  });

  it("uses the same values in both languages", () => {
    for (const key of Object.keys(english))
      expect(argumentsOf(spanish[key]), key).toEqual(argumentsOf(english[key]));
  });

  it("has no empty text", () => {
    for (const [key, value] of Object.entries({ ...english, ...spanish }))
      expect(value.trim(), key).not.toBe("");
  });
});

describe("the current language", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    setLocale("en");
    vi.unstubAllGlobals();
  });

  it("translates text, plurals and dates", () => {
    expect(t("nav.settings")).toBe("Settings");
    expect(t("common.stops", { count: 1 })).toBe("1 stop");
    expect(t("common.stops", { count: 2 })).toBe("2 stops");
    expect(formatDayLabel("2026-12-17")).toBe("Thu, Dec 17");

    setLocale("es");
    expect(t("nav.settings")).toBe("Ajustes");
    expect(t("common.stops", { count: 1 })).toBe("1 parada");
    expect(t("common.stops", { count: 2 })).toBe("2 paradas");
    expect(formatDayLabel("2026-12-17")).toMatch(/^jue/);
    expect(document.documentElement.lang).toBe("es");
  });

  it("starts from what this browser chose last", () => {
    localStorage.setItem("locale", "es");
    initLocale();
    expect(getLocale()).toBe("es");
  });

  it("otherwise follows the browser's language", () => {
    expect(browserLanguage("es-MX")).toBe("es");
    expect(browserLanguage("ES")).toBe("es");
    expect(browserLanguage("en-GB")).toBe("en");
    expect(browserLanguage("ja")).toBe("en");
    expect(browserLanguage(undefined)).toBe("en");
  });
});
