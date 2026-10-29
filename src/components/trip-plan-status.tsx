"use client";

import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { usePlanStore } from "@/lib/plan-store";
import { useTripId } from "@/lib/use-trip-id";

function PlanStatus() {
  const tripId = useTripId();
  const ready = usePlanStore((s) => s.ready);
  const error = usePlanStore((s) => s.error);
  const stops = usePlanStore(
    (s) => s.items.filter((i) => i.status !== "removed").length,
  );

  if (!tripId) {
    return (
      <Badge variant="outline">
        Open your shared link with ?trip= to load the plan
      </Badge>
    );
  }
  if (error) {
    return (
      <Badge variant="destructive" className="whitespace-normal">
        Can&apos;t reach the plan: {error}
      </Badge>
    );
  }
  if (!ready) return <Badge variant="outline">Loading plan…</Badge>;
  return <Badge variant="secondary">{stops} planned stops</Badge>;
}

export function TripPlanStatus() {
  return (
    <Suspense fallback={<Badge variant="outline">Loading plan…</Badge>}>
      <PlanStatus />
    </Suspense>
  );
}
