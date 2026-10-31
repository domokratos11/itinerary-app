import { createTranslator } from "use-intl/core";
import { create } from "zustand";

import type { MessageKey, MessageValues } from "@/domain/i18n";
import type { Language } from "@/domain/user-repository";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const STORAGE_KEY = "locale";

// What Intl formats dates with. "es-419" is Latin American Spanish.
const INTL_LOCALE: Record<Language, string> = { en: "en-US", es: "es-419" };

const translators = {
  en: createTranslator({ locale: INTL_LOCALE.en, messages: en }),
  es: createTranslator({ locale: INTL_LOCALE.es, messages: es }),
} as unknown as Record<
  Language,
  (key: string, values?: MessageValues) => string
>;

// The current language. The whole app remounts when it changes (LocaleRoot),
// so t() can be called anywhere, in or out of a component. English until
// initLocale runs, which is the only thing the static HTML could ever show,
// and it shows no text.
export const useLocale = create<{ locale: Language }>()(() => ({
  locale: "en",
}));

export function getLocale(): Language {
  return useLocale.getState().locale;
}

export function intlLocale(): string {
  return INTL_LOCALE[getLocale()];
}

export function t(key: MessageKey, values?: MessageValues): string {
  return translators[getLocale()](key, values);
}

export function parseLanguage(
  value: string | null | undefined,
): Language | null {
  return value === "en" || value === "es" ? value : null;
}

// Anything Spanish gets Spanish; everything else gets English.
export function browserLanguage(tag: string | undefined): Language {
  return tag?.toLowerCase().startsWith("es") ? "es" : "en";
}

export function setLocale(locale: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not remembered; the signed-in profile still has it.
  }
  document.documentElement.lang = locale;
  useLocale.setState({ locale });
}

// Before sign-in there is no profile yet: use what this browser chose last,
// or its own language.
export function initLocale(): void {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Blocked storage: fall through to the browser's language.
  }
  setLocale(parseLanguage(stored) ?? browserLanguage(navigator.language));
}
