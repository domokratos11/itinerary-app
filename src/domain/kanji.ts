import { z } from "zod";

import { bilingual } from "@/domain/bilingual";

// The kanji study list (src/data/kanji.json): twenty per phrasebook topic,
// chosen for what the trip will put in front of you. Static app content, not
// trip data, so it ships with the app and works offline. Its texts carry both
// languages; the schema refuses an entry missing either.

export const KANJI_SECTIONS = [
  "foundations",
  "konbini",
  "airport",
  "trains",
  "restaurants",
  "hotel",
  "clothes",
  "souvenirs",
  "sightseeing",
  "drugstore",
  "smalltalk",
  "trouble",
] as const;
export type KanjiSectionId = (typeof KANJI_SECTIONS)[number];

export const KANJI_PER_SECTION = 20;

const Bilingual = bilingual(1000);

const Reading = z
  .object({
    kana: z.string().regex(/^[぀-ヿ()]+$/u),
    romaji: z.string().min(1),
  })
  .strict();

// One CJK ideograph.
const KanjiChar = z.string().regex(/^\p{Script=Han}$/u);

export const KanjiSchema = z
  .object({
    char: KanjiChar,
    meaning: Bilingual,
    on: z.array(Reading),
    kun: z.array(Reading),
    example: z
      .object({
        word: z.string().min(1),
        kana: z.string().min(1),
        romaji: z.string().min(1),
        // How the kanji itself sounds in this word.
        reading: z.string().min(1),
        meaning: Bilingual,
      })
      .strict(),
    whereSeen: Bilingual,
  })
  .strict()
  .refine((k) => k.example.word.includes(k.char), "Example lacks the kanji")
  .refine((k) => k.on.length + k.kun.length > 0, "No reading");

export const KanjiSetSchema = z
  .object({
    sections: z
      .array(
        z
          .object({
            id: z.enum(KANJI_SECTIONS),
            intro: Bilingual,
            kanji: z.array(KanjiSchema).length(KANJI_PER_SECTION),
          })
          .strict()
          .refine(
            (s) => new Set(s.kanji.map((k) => k.char)).size === s.kanji.length,
            "A kanji repeats within a section",
          ),
      )
      .length(KANJI_SECTIONS.length),
  })
  .strict();

export type Kanji = z.infer<typeof KanjiSchema>;
export type KanjiSection = z.infer<typeof KanjiSetSchema>["sections"][number];

// Romaji with its long-vowel marks removed, so "kuko" finds "kūkō".
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();
}

// Kanji whose character, readings, example or meaning (in either language)
// contain the query. Blank finds nothing.
export function searchKanji(
  sections: readonly KanjiSection[],
  query: string,
): { section: KanjiSectionId; kanji: Kanji }[] {
  const q = plain(query.trim());
  if (!q) return [];
  return sections.flatMap((section) =>
    section.kanji
      .filter((k) =>
        [
          k.char,
          k.meaning.en,
          k.meaning.es,
          k.example.word,
          k.example.kana,
          k.example.romaji,
          k.example.meaning.en,
          k.example.meaning.es,
          ...k.on.flatMap((r) => [r.kana, r.romaji]),
          ...k.kun.flatMap((r) => [r.kana, r.romaji]),
        ].some((field) => plain(field).includes(q)),
      )
      .map((kanji) => ({ section: section.id, kanji })),
  );
}
