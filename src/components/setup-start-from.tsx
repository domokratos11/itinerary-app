"use client";

import { FilePlus } from "lucide-react";

import { CopyItinerary, type CopyDone } from "@/components/copy-itinerary";
import {
  StepIntro,
  WizardActions,
  type StepNav,
} from "@/components/setup-parts";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

// "Start from": an empty itinerary, or parts of another one. The wizard
// shows this step only when there is another itinerary to copy from
// (useCanCopy); with "Start empty" alone it would be no choice.
export function StartFromStep({
  tripId,
  nav,
  filled,
  onCopied,
}: {
  tripId: string;
  nav: StepNav;
  filled: boolean;
  // After a copy: what it brought. The wizard then moves on.
  onCopied: (done: CopyDone) => void;
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
        <CopyItinerary tripId={tripId} trigger="card" onCopied={onCopied} />
      </div>
      <WizardActions nav={nav} filled={filled} />
    </>
  );
}
