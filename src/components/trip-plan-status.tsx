"use client";

import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";
import { usePlanStore } from "@/lib/plan-store";

function PlanStatus() {
  const ready = usePlanStore((s) => s.ready);
  const error = usePlanStore((s) => s.error);
  const stops = usePlanStore(
    (s) => s.items.filter((i) => i.status !== "removed").length,
  );

  if (error) {
    return (
      <Badge
        variant="destructive"
        className="h-auto py-1 text-left whitespace-normal"
      >
        {t("home.planError", { error })}
      </Badge>
    );
  }
  if (!ready)
    return (
      <Badge
        variant="outline"
        className="h-auto py-1 text-left whitespace-normal"
      >
        {t("home.planLoading")}
      </Badge>
    );
  return (
    <Badge
      variant="secondary"
      className="h-auto py-1 text-left whitespace-normal"
    >
      {t("home.plannedStops", { count: stops })}
    </Badge>
  );
}

export function TripPlanStatus() {
  return (
    <Suspense
      fallback={
        <Badge
          variant="outline"
          className="h-auto py-1 text-left whitespace-normal"
        >
          {t("home.planLoading")}
        </Badge>
      }
    >
      <PlanStatus />
    </Suspense>
  );
}
