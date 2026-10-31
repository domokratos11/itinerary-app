"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES, type Language } from "@/domain/user-repository";
import { useAuthStore } from "@/lib/auth-store";
import { setLocale, t, useLocale } from "@/lib/i18n";
import { userRepository } from "@/lib/user-repository-instance";

// Each language in its own words, so anyone can find theirs.
const NAMES: Record<Language, string> = { en: "English", es: "Español" };

// Takes effect at once and follows the person to their other devices.
export function LanguageSelect({ id }: { id: string }) {
  const locale = useLocale((s) => s.locale);
  const uid = useAuthStore((s) => s.user?.uid ?? null);

  function choose(language: Language) {
    setLocale(language);
    if (uid)
      userRepository.update(uid, { language }).catch(() => {
        // Still in effect here, and the next change tries again.
      });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t("language.label")}</Label>
      <Select value={locale} onValueChange={(v) => choose(v as Language)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{NAMES[locale]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((language) => (
            <SelectItem key={language} value={language}>
              {NAMES[language]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
