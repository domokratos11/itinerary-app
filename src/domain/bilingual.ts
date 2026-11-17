import { z } from "zod";

import type { Language } from "@/domain/user-repository";

// A text written in both of the app's languages, for content that isn't
// part of the interface (kanji notes, city notes). A short word can be the
// same in both ("total", "Hiroshima"); a longer text that matches is an
// untranslated copy and is refused.
export function bilingual(max: number) {
  return z
    .object({ en: z.string().min(1).max(max), es: z.string().min(1).max(max) })
    .strict()
    .refine(
      (t) => t.en !== t.es || t.en.length <= 20,
      "Spanish must be a translation",
    );
}

export type Bilingual = { en: string; es: string };

export function inLanguage(text: Bilingual, language: Language): string {
  return text[language];
}
