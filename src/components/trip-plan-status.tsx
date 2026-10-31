"use client";

import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
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
        Can&apos;t reach the plan: {error}
      </Badge>
    );
  }
  if (!ready)
    return (
      <Badge
        variant="outline"
        className="h-auto py-1 text-left whitespace-normal"
      >
        Loading plan…
      </Badge>
    );
  return (
    <Badge
      variant="secondary"
      className="h-auto py-1 text-left whitespace-normal"
    >
      {stops} planned stops
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
          Loading plan…
        </Badge>
      }
    >
      <PlanStatus />
    </Suspense>
  );
}
