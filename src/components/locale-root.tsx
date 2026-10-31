"use client";

import { Fragment, type ReactNode } from "react";

import { useLocale } from "@/lib/i18n";

// Remounts everything inside when the language changes, so every t() runs
// again in the new language.
export function LocaleRoot({ children }: { children: ReactNode }) {
  const locale = useLocale((s) => s.locale);
  return <Fragment key={locale}>{children}</Fragment>;
}
