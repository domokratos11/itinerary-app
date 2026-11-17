"use client";

import { Search, Volume2 } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import data from "@/data/kanji.json";
import {
  KANJI_SECTIONS,
  searchKanji,
  type Kanji,
  type KanjiSection,
  type KanjiSectionId,
} from "@/domain/kanji";
import { getLocale, t } from "@/lib/i18n";
import { speakJapanese, useCanSpeakJapanese } from "@/lib/speech";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

// Parsed by `npm run validate` and kanji.test.ts; read as typed here.
const SECTIONS = (data as { sections: KanjiSection[] }).sections;

export const KANJI_SIZES = ["s", "m", "l", "xl"] as const;
export type KanjiSize = (typeof KANJI_SIZES)[number];
const SIZE_KEY = "kanji-size";
// Shown at each size on the size buttons: the kanji for "character".
const SIZE_GLYPH = "字";

// The grid at each size: fewer, bigger cards as it grows. Phones first,
// then more columns from sm and lg.
const GRID: Record<KanjiSize, string> = {
  s: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  m: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  l: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  xl: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};
const CHAR: Record<KanjiSize, string> = {
  s: "text-5xl",
  m: "text-6xl",
  l: "text-8xl",
  xl: "text-[9rem]",
};

// The size is a preference of this device, kept across updates (KEPT_KEYS).
const sizeListeners = new Set<() => void>();
function readSize(): KanjiSize {
  try {
    const saved = localStorage.getItem(SIZE_KEY);
    return KANJI_SIZES.includes(saved as KanjiSize)
      ? (saved as KanjiSize)
      : "m";
  } catch {
    return "m";
  }
}
function saveSize(size: KanjiSize) {
  try {
    localStorage.setItem(SIZE_KEY, size);
  } catch {
    // Blocked storage: the size lasts until the page closes.
  }
  for (const listener of sizeListeners) listener();
}
function useKanjiSize(): KanjiSize {
  return useSyncExternalStore(
    (listener) => {
      sizeListeners.add(listener);
      return () => sizeListeners.delete(listener);
    },
    readSize,
    () => "m",
  );
}

// Kanji by phrasebook topic, twenty each, with meaning, readings, an example
// as seen in Japan and where it shows up on the trip. A size control enlarges
// the characters; tapping one shows it full width with its readings and a
// Listen button. Works offline: the list ships with the app.
export function KanjiScreen() {
  const language = getLocale();
  const wide = useMediaQuery("(min-width: 1024px)");
  const size = useKanjiSize();
  const [sectionId, setSectionId] = useState<KanjiSectionId>("foundations");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Kanji | null>(null);

  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];
  const results = useMemo(() => searchKanji(SECTIONS, query), [query]);
  const searching = query.trim() !== "";
  const shown = searching ? results.map((r) => r.kanji) : section.kanji;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t("kanji.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("kanji.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("kanji.searchPlaceholder")}
            aria-label={t("kanji.search")}
            className="pl-9"
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={size}
          onValueChange={(v) => v && saveSize(v as KanjiSize)}
          aria-label={t("kanji.size")}
          className="self-start"
        >
          {KANJI_SIZES.map((s) => (
            <ToggleGroupItem
              key={s}
              value={s}
              aria-label={t(`kanji.sizes.${s}`)}
              className="px-3"
            >
              <span
                lang="ja"
                aria-hidden
                className={cn(
                  "leading-none",
                  { s: "text-xs", m: "text-sm", l: "text-base", xl: "text-xl" }[
                    s
                  ],
                )}
              >
                {SIZE_GLYPH}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {!searching &&
        (wide ? (
          <Tabs
            value={sectionId}
            onValueChange={(v) => setSectionId(v as KanjiSectionId)}
          >
            <TabsList
              aria-label={t("kanji.topic")}
              className="h-auto flex-wrap justify-start"
            >
              {KANJI_SECTIONS.map((id) => (
                <TabsTrigger key={id} value={id}>
                  {t(`kanji.sections.${id}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <Select
            value={sectionId}
            onValueChange={(v) => setSectionId(v as KanjiSectionId)}
          >
            <SelectTrigger aria-label={t("kanji.topic")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KANJI_SECTIONS.map((id) => (
                <SelectItem key={id} value={id}>
                  {t(`kanji.sections.${id}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

      <p className="max-w-3xl text-sm text-muted-foreground">
        {searching
          ? t("kanji.results", { count: results.length })
          : section.intro[language]}
      </p>

      <ul className={cn("grid gap-3", GRID[size])}>
        {shown.map((kanji) => (
          <li key={`${kanji.char}-${kanji.example.word}`} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen(kanji)}
              aria-label={t("kanji.open", {
                char: kanji.char,
                meaning: kanji.meaning[language],
              })}
              className="flex h-full w-full flex-col items-center gap-1 rounded-xl border bg-card p-3 text-center transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span
                lang="ja"
                className={cn("leading-tight font-medium", CHAR[size])}
              >
                {kanji.char}
              </span>
              <span className="line-clamp-2 text-sm font-medium">
                {kanji.meaning[language]}
              </span>
              {size !== "s" && (
                <span className="text-xs text-muted-foreground">
                  <span lang="ja">{kanji.example.word}</span>{" "}
                  {kanji.example.romaji}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <KanjiDetail
        kanji={open}
        wide={wide}
        onClose={() => setOpen(null)}
        language={language}
      />
    </div>
  );
}

function KanjiDetail({
  kanji,
  wide,
  onClose,
  language,
}: {
  kanji: Kanji | null;
  wide: boolean;
  onClose: () => void;
  language: "en" | "es";
}) {
  const open = kanji !== null;
  const title = kanji ? `${kanji.char} · ${kanji.meaning[language]}` : "";
  const description = t("kanji.detailDescription");
  const body = kanji ? <KanjiBody kanji={kanji} language={language} /> : null;

  if (wide)
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader className="text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <SheetBody>{body}</SheetBody>
        </SheetContent>
      </Sheet>
    );
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {body}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function KanjiBody({
  kanji,
  language,
}: {
  kanji: Kanji;
  language: "en" | "es";
}) {
  const canSpeak = useCanSpeakJapanese();
  return (
    <div className="flex flex-col gap-5">
      <p
        lang="ja"
        className="text-center text-[min(55vw,14rem)] leading-none font-medium"
      >
        {kanji.char}
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {kanji.on.length > 0 && (
          <>
            <dt className="text-muted-foreground">{t("kanji.on")}</dt>
            <dd>
              <Readings readings={kanji.on} />
            </dd>
          </>
        )}
        {kanji.kun.length > 0 && (
          <>
            <dt className="text-muted-foreground">{t("kanji.kun")}</dt>
            <dd>
              <Readings readings={kanji.kun} />
            </dd>
          </>
        )}
      </dl>

      <section className="flex flex-col gap-1 rounded-xl border p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">
          {t("kanji.example")}
        </h3>
        <p lang="ja" className="text-4xl font-medium">
          {kanji.example.word}
        </p>
        <p className="text-sm">
          <span lang="ja">{kanji.example.kana}</span> · {kanji.example.romaji}
        </p>
        <p className="text-sm font-medium">{kanji.example.meaning[language]}</p>
        <p className="text-xs text-muted-foreground">
          {t("kanji.readsAs", { char: kanji.char })}{" "}
          <span lang="ja" className="font-medium text-foreground">
            {kanji.example.reading}
          </span>
        </p>
        {canSpeak && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 self-start"
            onClick={() => speakJapanese(kanji.example.kana)}
          >
            <Volume2 data-icon="inline-start" />
            {t("kanji.listen")}
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">
          {t("kanji.whereSeen")}
        </h3>
        <p className="text-sm">{kanji.whereSeen[language]}</p>
      </section>
    </div>
  );
}

function Readings({
  readings,
}: {
  readings: { kana: string; romaji: string }[];
}) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {readings.map((r) => (
        <span key={r.kana}>
          <span lang="ja" className="font-medium">
            {r.kana}
          </span>{" "}
          <span className="text-muted-foreground">{r.romaji}</span>
        </span>
      ))}
    </span>
  );
}
