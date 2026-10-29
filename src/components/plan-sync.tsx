"use client";

import { useTripId } from "@/lib/use-trip-id";
import { usePlanSync } from "@/lib/use-plan-sync";

// Mounted once in the root layout, so the plan stays live on every page.
export function PlanSync() {
  usePlanSync(useTripId());
  return null;
}
