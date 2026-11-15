"use client";

import type { ReactNode } from "react";
import { FilePlus } from "lucide-react";

import {
  StepIntro,
  WizardActions,
  type StepNav,
} from "@/components/setup-parts";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

// Where copying from another itinerary plugs in. It returns the panel that
// offers it beside "Start empty", or null while there is no such panel. With
// null, "Start from" would have one choice only, so the wizard leaves the
// step out (setupSteps({ canCopy: false })).
export function copyPanel(tripId: string): ReactNode | null {
  void tripId;
  return null;
}

// "Start from": an empty itinerary, or (with copyPanel) parts of another.
export function StartFromStep({
  nav,
  filled,
  copy,
}: {
  nav: StepNav;
  filled: boolean;
  copy: ReactNode | null;
}) {
  return (
    <>
      <StepIntro step="startFrom" hint={t("setup.startFromHint")} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="h-auto flex-col items-start gap-1 p-4 text-left whitespace-normal"
          onClick={nav.next}
        >
          <span className="flex items-center gap-2 font-medium">
            <FilePlus />
            {t("setup.startEmpty")}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {t("setup.startEmptyHint")}
          </span>
        </Button>
        {copy}
      </div>
      <WizardActions nav={nav} filled={filled} />
    </>
  );
}
