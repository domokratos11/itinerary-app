"use client";

import { useEffect, useState } from "react";

import type { QueuedPlace } from "@/domain/queue";
import { useAuthStore } from "@/lib/auth-store";
import { queueRepository } from "@/lib/queue-repository-instance";

// Live list of queued links for the trip. Empty until a trip ID is known.
export function useQueue(tripId: string | null): {
  items: QueuedPlace[];
  error: string | null;
} {
  const [state, setState] = useState<{
    items: QueuedPlace[];
    error: string | null;
  }>({ items: [], error: null });

  // A listener refused before sign-in would stay dead, so wait for it.
  const member = useAuthStore((s) => s.access === "member");

  useEffect(() => {
    if (!tripId || !member) return;
    return queueRepository.subscribe(
      tripId,
      (items) => setState({ items, error: null }),
      (error) => setState({ items: [], error: error.message }),
    );
  }, [tripId, member]);

  return state;
}
