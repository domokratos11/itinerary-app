"use client";

import { Suspense, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { usePlanStore } from "@/lib/plan-store";
import { usePlanSync } from "@/lib/use-plan-sync";
import { resolveTripId } from "@/lib/trip-id";

// The trip ID comes from the URL and localStorage, neither of which changes
// while the page is open, so there is nothing to subscribe to.
const noopSubscribe = () => () => {};

function PlanStatus() {
  const params = useSearchParams();
  // Null on the server and during hydration, so the static HTML matches the
  // first client render; the real ID is read on the client afterwards.
  const tripId = useSyncExternalStore(
    noopSubscribe,
    () => resolveTripId(params.get("trip")),
    () => null,
  );

  usePlanSync(tripId);

  const ready = usePlanStore((s) => s.ready);
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
