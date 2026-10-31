"use client";

import { useSearchParams } from "next/navigation";

import { useAuthStore } from "@/lib/auth-store";
import { useAuthSync } from "@/lib/use-auth-sync";
import { useTripId } from "@/lib/use-trip-id";
import { usePlanSync } from "@/lib/use-plan-sync";
import { useTripSync } from "@/lib/use-trip-sync";

// Mounted once in the root layout, so the trip and its plan stay live on
// every page. The listeners open only for a signed-in member; until then
// the rules would refuse them. Must be used inside a Suspense boundary.
export function PlanSync() {
  useAuthSync(useSearchParams().get("trip"));
  const tripId = useTripId();
  const member = useAuthStore((s) => s.access === "member");
  const liveTripId = member ? tripId : null;
  usePlanSync(liveTripId);
  useTripSync(liveTripId);
  return null;
}
