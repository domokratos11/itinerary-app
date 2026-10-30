"use client";

import { useEffect } from "react";

import type { TripRepository } from "@/domain/trip-repository";
import { watchUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth-store";
import { tripRepository } from "@/lib/trip-repository-instance";

// Tracks who is signed in and whether they are a member of the open trip.
// Nothing runs until a trip ID is known, so the build never touches
// Firebase and the trip-less preview needs no sign-in.
export function useAuthSync(
  tripId: string | null,
  repository: TripRepository = tripRepository,
): void {
  const uid = useAuthStore((s) => s.user?.uid ?? null);

  useEffect(() => {
    if (!tripId) return;
    return watchUser((user) => useAuthStore.getState().setUser(user));
  }, [tripId]);

  // Restarted for each user, so a different account is checked afresh.
  useEffect(() => {
    if (!tripId || !uid) return;
    useAuthStore.getState().setAccess("checking");
    return repository.watchAccess(tripId, (access) =>
      useAuthStore.getState().setAccess(access),
    );
  }, [tripId, uid, repository]);
}
