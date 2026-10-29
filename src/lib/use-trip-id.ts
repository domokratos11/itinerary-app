"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";

import { resolveTripId } from "@/lib/trip-id";

// The trip ID comes from the URL and localStorage, neither of which changes
// while the page is open, so there is nothing to subscribe to.
const noopSubscribe = () => () => {};

// Null on the server and during hydration, so the static HTML matches the
// first client render. Must be used inside a Suspense boundary.
export function useTripId(): string | null {
  const params = useSearchParams();
  return useSyncExternalStore(
    noopSubscribe,
    () => resolveTripId(params.get("trip")),
    () => null,
  );
}
