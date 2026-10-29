"use client";

import { useEffect } from "react";

import type { PlanRepository } from "@/domain/plan-repository";
import { FirestorePlanRepository } from "@/lib/firestore-plan-repository";
import { usePlanStore } from "@/lib/plan-store";

const firestorePlan = new FirestorePlanRepository();

// Keeps one listener open for the trip and feeds the Zustand store.
// Nothing runs until a trip ID is known, so the build never touches Firebase.
export function usePlanSync(
  tripId: string | null,
  repository: PlanRepository = firestorePlan,
): void {
  useEffect(() => {
    if (!tripId) return;
    const stop = repository.subscribe(tripId, (items) =>
      usePlanStore.getState().setItems(items),
    );
    return () => {
      stop();
      usePlanStore.getState().reset();
    };
  }, [tripId, repository]);
}
