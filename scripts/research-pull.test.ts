import { describe, expect, it } from "vitest";

import { newProposal } from "../src/domain/proposals";
import { freeFileName, orphanedRequests } from "./research-pull";

const NOW = new Date("2026-11-01T00:00:00.000Z");

describe("orphanedRequests", () => {
  const requested = (placeId: string) => newProposal(placeId, placeId, NOW);

  it("finds requests whose place is archived or gone", () => {
    const orphans = orphanedRequests(
      [requested("live"), requested("archived")],
      new Set(["live"]),
    );
    expect(orphans.map((p) => p.placeId)).toEqual(["archived"]);
  });

  it("leaves finished research alone", () => {
    const ready = { ...requested("archived"), status: "ready" as const };
    expect(orphanedRequests([ready], new Set())).toEqual([]);
  });
});

describe("freeFileName", () => {
  it("uses the plain name when it is free", () => {
    expect(freeFileName("2026-11-01", () => false)).toBe(
      "proposals-2026-11-01.json",
    );
  });

  it("numbers the name rather than overwrite a file", () => {
    const taken = new Set([
      "proposals-2026-11-01.json",
      "proposals-2026-11-01-2.json",
    ]);
    expect(freeFileName("2026-11-01", (name) => taken.has(name))).toBe(
      "proposals-2026-11-01-3.json",
    );
  });
});
