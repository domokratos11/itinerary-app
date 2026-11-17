"use client";

import { JapaneseYen, Volume2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  COUNTER_IDS,
  counterSymbol,
  readJapanese,
  type CounterId,
  type HelperMode,
  type HelperResult,
  type JapaneseReading,
} from "@/domain/japanese-numbers";
import { intlLocale, t } from "@/lib/i18n";
import { speakJapanese, useCanSpeakJapanese } from "@/lib/speech";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

const MODES: readonly HelperMode[] = ["price", "number", "time", "counter"];

// A few taps to try, typed the way they are seen in Japan.
const EXAMPLES: Record<HelperMode, readonly string[]> = {
  price: ["1,980", "12,800", "540"],
  number: ["300", "8,000", "10,000,000"],
  time: ["15:30", "9:00", "19:45"],
  counter: ["1", "3", "8"],
};

// The number helper on the phrasebook screen: type a price, number, time or
// count and see and hear it in Japanese. A button that opens it in a bottom
// Drawer on phones and a side Sheet on desktop (from lg). The readings come
// from src/domain/japanese-numbers.ts; Listen uses the device's own voice.
export function NumberHelper({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const wide = useMediaQuery("(min-width: 1024px)");
  const title = t("phrasebook.numbers.title");
  const description = t("phrasebook.numbers.description");

  const trigger = (
    <Button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t("phrasebook.numbers.openLabel")}
      className={cn("rounded-full shadow-lg", className)}
    >
      <JapaneseYen data-icon="inline-start" />
      {t("phrasebook.numbers.open")}
    </Button>
  );

  if (wide) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="w-full overflow-y-auto sm:max-w-md"
          >
            <SheetHeader className="text-left">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </SheetHeader>
            <SheetBody>
              <NumberHelperBody />
            </SheetBody>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[90dvh]">
          <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </DrawerHeader>
            <NumberHelperBody />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// The four modes, each keeping what was typed in it.
export function NumberHelperBody() {
  return (
    <Tabs defaultValue="price">
      <TabsList
        className="w-full"
        aria-label={t("phrasebook.numbers.modes.label")}
      >
        {MODES.map((mode) => (
          <TabsTrigger key={mode} value={mode}>
            {t(`phrasebook.numbers.modes.${mode}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      {MODES.map((mode) => (
        <TabsContent key={mode} value={mode} className="pt-2">
          <ModePanel mode={mode} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ModePanel({ mode }: { mode: HelperMode }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [counter, setCounter] = useState<CounterId>("tsu");
  const result = readJapanese(mode, value, counter);
  const problem = result.status !== "ok" && result.status !== "empty";

  return (
    <div className="flex flex-col gap-4">
      {mode === "counter" && (
        <CounterPicker value={counter} onChange={setCounter} />
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{t(`phrasebook.numbers.input.${mode}`)}</Label>
        {/* The number pad on phones; times can be typed 1530 there. */}
        <Input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={t(`phrasebook.numbers.placeholder.${mode}`)}
          aria-invalid={problem || undefined}
          aria-describedby={`${id}-result`}
          className="h-12 text-xl tabular-nums md:text-xl"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t("phrasebook.numbers.examples")}
        </span>
        {EXAMPLES[mode].map((example) => (
          <Button
            key={example}
            type="button"
            variant="outline"
            size="sm"
            className="tabular-nums"
            onClick={() => setValue(example)}
          >
            {example}
          </Button>
        ))}
      </div>
      <div id={`${id}-result`} aria-live="polite">
        <Result mode={mode} result={result} />
      </div>
    </div>
  );
}

function CounterPicker({
  value,
  onChange,
}: {
  value: CounterId;
  onChange: (id: CounterId) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t("phrasebook.numbers.counter")}</p>
      <ToggleGroup
        type="single"
        variant="outline"
        value={value}
        onValueChange={(v) => v && onChange(v as CounterId)}
        aria-label={t("phrasebook.numbers.counter")}
        className="grid w-full grid-cols-4"
      >
        {COUNTER_IDS.map((id) => (
          <ToggleGroupItem
            key={id}
            value={id}
            className="h-auto min-w-0 flex-col gap-0 rounded-2xl px-1 py-2 whitespace-normal"
          >
            <span lang="ja" className="text-lg leading-tight font-bold">
              {counterSymbol(id)}
            </span>
            <span className="text-[11px] leading-tight">
              {t(`phrasebook.numbers.counters.${id}.name`)}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-sm text-muted-foreground">
        {t(`phrasebook.numbers.counters.${value}.counts`)}
      </p>
    </div>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat(intlLocale()).format(n);
}

function Result({ mode, result }: { mode: HelperMode; result: HelperResult }) {
  switch (result.status) {
    case "empty":
      return (
        <p className="text-sm text-muted-foreground">
          {t(
            mode === "time"
              ? "phrasebook.numbers.emptyTime"
              : "phrasebook.numbers.empty",
          )}
        </p>
      );
    case "invalid":
      return (
        <p className="text-sm text-destructive">
          {t(
            mode === "time"
              ? "phrasebook.numbers.invalidTime"
              : "phrasebook.numbers.invalid",
          )}
        </p>
      );
    case "range":
      return (
        <p className="text-sm text-destructive">
          {t("phrasebook.numbers.range", {
            min: formatNumber(result.min),
            max: formatNumber(result.max),
          })}
        </p>
      );
    case "timeRange":
      return (
        <p className="text-sm text-destructive">
          {t("phrasebook.numbers.timeRange")}
        </p>
      );
  }

  const [main, ...others] = result.readings;
  return (
    <div className="flex flex-col gap-3">
      <ReadingCard
        reading={main.reading}
        label={mode === "time" ? t("phrasebook.numbers.kinds.clock") : null}
        digits={mode === "time" ? null : result.digits}
        large
      />
      {others.map(({ kind, reading }) => (
        <ReadingCard
          key={kind}
          reading={reading}
          label={t(
            kind === "half"
              ? "phrasebook.numbers.kinds.half"
              : "phrasebook.numbers.kinds.twelveHour",
          )}
        />
      ))}
      {result.alternatives.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("phrasebook.numbers.alsoHeard")}
          </h3>
          {result.alternatives.map((reading) => (
            <ReadingLine key={reading.kana} reading={reading} />
          ))}
        </section>
      )}
    </div>
  );
}

function ListenButton({
  reading,
  withText = false,
}: {
  reading: JapaneseReading;
  withText?: boolean;
}) {
  const canSpeak = useCanSpeakJapanese();
  if (!canSpeak) return null;
  // The kana, so the voice says exactly the reading shown (and each button
  // has its own name when a reading has others also heard).
  return (
    <Button
      type="button"
      variant="outline"
      size={withText ? "default" : "icon"}
      className="shrink-0"
      aria-label={t("phrasebook.numbers.listenTo", { text: reading.kana })}
      onClick={() => speakJapanese(reading.kana)}
    >
      <Volume2 data-icon={withText ? "inline-start" : undefined} />
      {withText && t("phrasebook.numbers.listen")}
    </Button>
  );
}

function ReadingCard({
  reading,
  label,
  digits = null,
  large = false,
}: {
  reading: JapaneseReading;
  label: string | null;
  digits?: string | null;
  large?: boolean;
}) {
  return (
    <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
      {label && (
        <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      )}
      <div className="flex items-start gap-3">
        <p
          lang="ja"
          className={cn(
            "min-w-0 flex-1 font-bold [overflow-wrap:anywhere] [line-break:strict]",
            large ? "text-4xl leading-tight lg:text-5xl" : "text-2xl",
          )}
        >
          {reading.written}
        </p>
        <ListenButton reading={reading} withText={large} />
      </div>
      {digits && (
        <p lang="ja" className="text-sm text-muted-foreground tabular-nums">
          {digits}
        </p>
      )}
      <p
        lang="ja"
        className={cn("[overflow-wrap:anywhere]", large && "text-lg")}
      >
        {reading.kana}
      </p>
      <p className="text-muted-foreground italic">{reading.romaji}</p>
    </section>
  );
}

function ReadingLine({ reading }: { reading: JapaneseReading }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p lang="ja">{reading.kana}</p>
        <p className="text-sm text-muted-foreground italic">{reading.romaji}</p>
      </div>
      <ListenButton reading={reading} />
    </div>
  );
}
