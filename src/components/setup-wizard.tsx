"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, LayoutList, WifiOff } from "lucide-react";
import { toast } from "sonner";

import {
  CitiesStep,
  DetailsStep,
  FlightsStep,
  HotelsStep,
  PeopleStep,
  SummaryStep,
} from "@/components/setup-steps";
import { type StepNav } from "@/components/setup-parts";
import { copyPanel, StartFromStep } from "@/components/setup-start-from";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  isSkippable,
  isStepFilled,
  resumeStep,
  setupSteps,
  type SetupInput,
} from "@/domain/setup";
import type { TripSummary } from "@/domain/trip-repository";
import { t } from "@/lib/i18n";
import { useActiveTrip } from "@/lib/auth-store";
import { openTripPicker } from "@/lib/trip-id";
import { tripRepository } from "@/lib/trip-repository-instance";
import { useTrip } from "@/lib/trip-store";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

// A new itinerary's setup, shown by AppGate instead of the app while the
// trip's `setup` is "pending" (only for a signed-in member, never on a
// read-only link). Full screen on phones; from lg a centred card with the
// steps down the side. Every step saves as it goes, so reopening resumes at
// the first step with nothing in it. "Finish later" and the summary's "Open
// itinerary" set `setup: "done"` and open the app (`onDone`).
export function SetupWizard({
  tripId,
  trip: initial,
  onDone,
}: {
  tripId: string;
  trip: TripSummary;
  onDone: () => void;
}) {
  const trip = useActiveTrip() ?? initial;
  const data = useTrip();
  const online = useOnline();
  const copy = copyPanel(tripId);
  const steps = useMemo(() => setupSteps({ canCopy: copy !== null }), [copy]);
  const input: SetupInput = { trip, data };
  const [index, setIndex] = useState(() =>
    Math.max(0, steps.indexOf(resumeStep(steps, input))),
  );
  const step = steps[index];
  const scroller = useRef<HTMLElement>(null);
  const detailsDone = isStepFilled("details", input);

  // Each step starts at its top.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [index]);

  // Safe offline too: the write waits in Firestore's cache and the app
  // opens at once.
  function finish() {
    tripRepository
      .updateTrip(tripId, { setup: "done" })
      .catch(() => toast.error(t("common.refused")));
    onDone();
  }

  const nav: StepNav = {
    back: index > 0 ? () => setIndex(index - 1) : null,
    skip: isSkippable(step) ? () => setIndex(index + 1) : null,
    next: () => setIndex(Math.min(index + 1, steps.length - 1)),
  };
  const filled = isStepFilled(step, input);
  const props = { tripId, nav, filled };

  return (
    <main
      ref={scroller}
      aria-labelledby="setup-title"
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-background lg:items-center lg:justify-center lg:bg-muted/40 lg:p-8"
    >
      <div className="flex w-full flex-1 flex-col lg:h-[min(46rem,100%)] lg:max-w-5xl lg:flex-none lg:flex-row lg:overflow-hidden lg:rounded-4xl lg:border lg:bg-card lg:shadow-xl">
        <nav
          aria-label={t("setup.stepList")}
          className="hidden w-64 shrink-0 flex-col gap-4 border-r bg-muted/40 p-6 lg:flex"
        >
          <p className="font-heading text-sm font-semibold text-muted-foreground">
            {t("setup.title")}
          </p>
          <ol className="flex flex-col gap-1">
            {steps.map((s, i) => {
              const done = isStepFilled(s, input);
              return (
                <li key={s}>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-current={i === index ? "step" : undefined}
                    disabled={!detailsDone && s !== "details"}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "h-auto w-full justify-start gap-3 py-2 text-left whitespace-normal",
                      i === index
                        ? "bg-background font-semibold shadow-sm"
                        : "font-normal text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                        done &&
                          "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {done ? <Check aria-label={t("setup.filled")} /> : i + 1}
                    </span>
                    {t(`setup.step.${s}`)}
                  </Button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          <header className="flex items-center gap-2 border-b px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 lg:border-b-0 lg:px-8 lg:pt-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground lg:hidden">
                {t("setup.title")}
              </p>
              <h1
                id="setup-title"
                className="truncate font-heading text-lg font-semibold"
              >
                {trip.name ?? t("common.myTrip")}
              </h1>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openTripPicker}
            >
              <LayoutList />
              <span className="sr-only sm:not-sr-only">
                {t("gate.allTrips")}
              </span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={finish}>
              {t("setup.finishLater")}
            </Button>
          </header>
          <div className="flex flex-col gap-2 px-4 pt-3 lg:hidden">
            <p className="text-xs text-muted-foreground">
              {t("setup.stepOf", { step: index + 1, total: steps.length })}
            </p>
            <Progress
              value={((index + 1) / steps.length) * 100}
              aria-label={t("setup.stepOf", {
                step: index + 1,
                total: steps.length,
              })}
              className="h-1.5"
            />
          </div>

          <section className="flex flex-1 flex-col gap-4 px-4 pt-4 lg:min-h-0 lg:overflow-y-auto lg:px-8">
            {!online ? (
              <div role="status" className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 font-heading text-2xl font-semibold">
                  <WifiOff aria-hidden className="size-5" />
                  {t("setup.offlineTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("setup.offlineBody")}
                </p>
              </div>
            ) : step === "details" ? (
              <DetailsStep {...props} trip={trip} />
            ) : step === "startFrom" ? (
              <StartFromStep nav={nav} filled={filled} copy={copy} />
            ) : step === "cities" ? (
              <CitiesStep {...props} />
            ) : step === "hotels" ? (
              <HotelsStep {...props} />
            ) : step === "flights" ? (
              <FlightsStep {...props} />
            ) : step === "people" ? (
              <PeopleStep {...props} trip={trip} />
            ) : (
              <SummaryStep
                input={input}
                steps={steps}
                nav={nav}
                onOpen={finish}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
