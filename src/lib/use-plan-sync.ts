"use client";

import { useEffect } from "react";

import type { PlanRepository } from "@/domain/plan-repository";
import { planRepository } from "@/lib/plan-repository-instance";
import { usePlanStore } from "@/lib/plan-store";

// Keeps one listener open for the trip and feeds the Zustand store.
// Nothing runs until a trip ID is known, so the build never touches Firebase.
export function usePlanSync(
  tripId: string | null,
  repository: PlanRepository = planRepository,
): void {
  useEffect(() => {
    if (!tripId) return;
    const stop = repository.subscribe(
      tripId,
      (items) => usePlanStore.getState().setItems(items),
      (error) => usePlanStore.getState().setError(error.message),
    );
    return () => {
      stop();
      usePlanStore.getState().reset();
    };
  }, [tripId, repository]);
}
