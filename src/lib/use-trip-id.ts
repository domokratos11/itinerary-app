"use client";

import { useAuthStore } from "@/lib/auth-store";

// The open trip, chosen in use-auth-sync. Null until then, which includes the
// server and hydration, so the static HTML matches the first client render.
export function useTripId(): string | null {
  return useAuthStore((s) => s.tripId);
}
