"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SetupStep } from "@/domain/setup";
import { t } from "@/lib/i18n";

// How a step moves on. `skip` is null for a step that can't be skipped and
// `back` for the first one.
export type StepNav = {
  back: (() => void) | null;
  skip: (() => void) | null;
  next: () => void;
};

// The step's name and what it asks for.
export function StepIntro({ step, hint }: { step: SetupStep; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-heading text-2xl font-semibold">
        {t(`setup.step.${step}`)}
      </h2>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

// Back, then Skip while the step is empty or Next once it has something.
// Stays at the bottom of the screen on phones and of the card from lg.
export function WizardActions({
  nav,
  filled,
  onNext,
  nextLabel,
  form,
  busy = false,
}: {
  nav: StepNav;
  filled: boolean;
  // Instead of nav.next, for a step that saves first.
  onNext?: () => void;
  nextLabel?: string;
  // Next submits this form instead.
  form?: string;
  busy?: boolean;
}) {
  const showNext = filled || !nav.skip;
  return (
    <div className="sticky bottom-0 -mx-4 mt-auto flex items-center gap-2 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:-mx-8 lg:bg-card lg:px-8 lg:pb-6">
      {nav.back && (
        <Button type="button" variant="ghost" onClick={nav.back}>
          <ChevronLeft />
          {t("setup.back")}
        </Button>
      )}
      <span className="flex-1" />
      {!showNext && nav.skip && (
        <Button type="button" variant="outline" onClick={nav.skip}>
          {t("setup.skip")}
        </Button>
      )}
      {showNext && (
        <Button
          type={form ? "submit" : "button"}
          form={form}
          disabled={busy}
          onClick={form ? undefined : (onNext ?? nav.next)}
        >
          {nextLabel ?? t("setup.next")}
          <ChevronRight />
        </Button>
      )}
    </div>
  );
}

export type AddedItem = {
  id: string;
  title: string;
  detail?: string;
  color?: string;
};

// What a step has so far, in short.
export function AddedList({
  items,
  empty,
}: {
  items: AddedItem[];
  empty: string;
}) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-3 rounded-lg border p-3 text-sm"
        >
          {item.color && (
            <span
              aria-hidden
              className="mt-1.5 size-3 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{item.title}</span>
            {item.detail && (
              <span className="block text-muted-foreground">{item.detail}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
