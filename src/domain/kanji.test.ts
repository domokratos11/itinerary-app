import { describe, expect, it } from "vitest";

import data from "@/data/kanji.json";
import {
  KANJI_PER_SECTION,
  KANJI_SECTIONS,
  KanjiSetSchema,
  searchKanji,
} from "@/domain/kanji";

const set = KanjiSetSchema.parse(data);

function hiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}

describe("the kanji list", () => {
  it("has twenty kanji for every phrasebook topic, in order", () => {
    expect(set.sections.map((s) => s.id)).toEqual(KANJI_SECTIONS);
    for (const section of set.sections)
      expect(section.kanji).toHaveLength(KANJI_PER_SECTION);
  });

  it("gives each example the reading it uses", () => {
    for (const section of set.sections)
      for (const kanji of section.kanji) {
        expect(kanji.example.word).toContain(kanji.char);
        expect(hiragana(kanji.example.kana)).toContain(
          hiragana(kanji.example.reading),
        );
      }
  });

  it("refuses a section with a kanji twice", () => {
    const copy = structuredClone(data);
    copy.sections[0].kanji[1] = copy.sections[0].kanji[0];
    expect(KanjiSetSchema.safeParse(copy).success).toBe(false);
  });

  it("refuses an untranslated text", () => {
    const copy = structuredClone(data);
    copy.sections[0].intro.es = copy.sections[0].intro.en;
    expect(KanjiSetSchema.safeParse(copy).success).toBe(false);
  });
});

describe("searchKanji", () => {
  it("finds by character, meaning in either language, or romaji", () => {
    expect(searchKanji(set.sections, "駅")[0].kanji.char).toBe("駅");
    expect(
      searchKanji(set.sections, "estación").some((r) => r.kanji.char === "駅"),
    ).toBe(true);
    expect(
      searchKanji(set.sections, "kuko").some((r) => r.kanji.char === "空"),
    ).toBe(true);
  });

  it("finds nothing for a blank query", () => {
    expect(searchKanji(set.sections, "  ")).toEqual([]);
  });
});
