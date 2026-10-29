"use client";

import { useEffect, useState } from "react";

import type { QueuedPlace } from "@/domain/queue";
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

  useEffect(() => {
    if (!tripId) return;
    return queueRepository.subscribe(
      tripId,
      (items) => setState({ items, error: null }),
      (error) => setState({ items: [], error: error.message }),
    );
  }, [tripId]);

  return state;
}
