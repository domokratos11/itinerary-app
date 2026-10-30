"use client";

import { useEffect } from "react";

import type { TripRepository } from "@/domain/trip-repository";
import { tripRepository } from "@/lib/trip-repository-instance";
import { useTripStore } from "@/lib/trip-store";

// Keeps the trip's cities, stays, reservations and places live. Nothing
// runs until a trip ID is known, so the build never touches Firebase.
export function useTripSync(
  tripId: string | null,
  repository: TripRepository = tripRepository,
): void {
  useEffect(() => {
    if (!tripId) return;
    const stop = repository.subscribe(
      tripId,
      (name, records) => useTripStore.getState().setCollection(name, records),
      (name, error) =>
        useTripStore.getState().setError(`${name}: ${error.message}`),
    );
    return () => {
      stop();
      useTripStore.getState().reset();
    };
  }, [tripId, repository]);
}
