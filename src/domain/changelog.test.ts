import { describe, expect, it } from "vitest";

import {
  CHANGELOG,
  changelogForDisplay,
  type ChangelogEntry,
} from "@/domain/changelog";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

function lookup(messages: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], messages);
}

function parts(version: string): number[] {
  return version.split(".").map(Number);
}

describe("changelogForDisplay", () => {
  const entries: ChangelogEntry[] = [
    { version: null, date: "2026-11-12", items: [] },
    { version: "1.0.4", date: "2026-11-01", items: [] },
  ];

  it("labels an undeployed entry with the running version", () => {
    const shown = changelogForDisplay(entries, "1.0.5");
    expect(shown.map((e) => e.version)).toEqual(["1.0.5", "1.0.4"]);
  });
});

describe("the changelog", () => {
  it("has valid versions and dates", () => {
    for (const entry of CHANGELOG) {
      if (entry.version !== null) {
        expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
      }
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("is newest first, with versions decreasing", () => {
    const versions = CHANGELOG.map((e) => e.version).filter(
      (v): v is string => v !== null,
    );
    for (let i = 1; i < versions.length; i++) {
      const [a, b] = [parts(versions[i - 1]), parts(versions[i])];
      const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
      expect(newer).toBeGreaterThan(0);
    }
    const dates = CHANGELOG.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("has undeployed entries only at the top", () => {
    const firstDeployed = CHANGELOG.findIndex((e) => e.version !== null);
    if (firstDeployed === -1) return;
    expect(
      CHANGELOG.slice(firstDeployed).every((e) => e.version !== null),
    ).toBe(true);
  });

  it("words every bullet in English and Spanish", () => {
    for (const entry of CHANGELOG) {
      expect(entry.items.length).toBeGreaterThan(0);
      for (const key of entry.items) {
        expect(typeof lookup(en, key)).toBe("string");
        expect(typeof lookup(es, key)).toBe("string");
        expect(lookup(es, key)).not.toBe(lookup(en, key));
      }
    }
  });
});
