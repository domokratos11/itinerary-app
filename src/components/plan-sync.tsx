"use client";

import { useTripId } from "@/lib/use-trip-id";
import { usePlanSync } from "@/lib/use-plan-sync";
import { useTripSync } from "@/lib/use-trip-sync";

// Mounted once in the root layout, so the trip and its plan stay live on
// every page.
export function PlanSync() {
  const tripId = useTripId();
  usePlanSync(tripId);
  useTripSync(tripId);
  return null;
}
