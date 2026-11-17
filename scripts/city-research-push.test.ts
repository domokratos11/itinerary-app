import { describe, expect, it } from "vitest";

import { readResults } from "./city-research-push";
import { SAMPLE_BRIEF } from "../src/test/sample-city-notes";

const result = (cityId: string, answer: string | null = null) => ({
  cityId,
  notes: SAMPLE_BRIEF,
  answer: answer ? { en: answer, es: `${answer} (es)` } : null,
});

describe("readResults", () => {
  it("merges several files, one entry per city", () => {
    const merged = readResults([
      JSON.stringify([result("nagoya"), result("kyoto")]),
      JSON.stringify([result("nagoya", "Because of the castle.")]),
    ]);
    expect(merged.map((r) => r.cityId).sort()).toEqual(["kyoto", "nagoya"]);
    expect(merged.find((r) => r.cityId === "nagoya")?.answer?.en).toBe(
      "Because of the castle.",
    );
  });

  it("refuses a file with an unknown field", () => {
    expect(() =>
      readResults([JSON.stringify([{ ...result("nagoya"), extra: 1 }])]),
    ).toThrow();
  });

  it("refuses notes without a source", () => {
    const bad = {
      ...result("nagoya"),
      notes: { ...SAMPLE_BRIEF, sources: [] },
    };
    expect(() => readResults([JSON.stringify([bad])])).toThrow();
  });
});
