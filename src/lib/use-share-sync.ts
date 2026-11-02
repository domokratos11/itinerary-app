"use client";

import { useEffect } from "react";

import { sharedTripData, shareStatus } from "@/domain/share";
import type { ShareRepository } from "@/domain/share-repository";
import { TRIP_COLLECTIONS } from "@/domain/trip";
import { usePlanStore } from "@/lib/plan-store";
import { shareRepository } from "@/lib/share-repository-instance";
import { useTripStore } from "@/lib/trip-store";
import { useViewerStore } from "@/lib/viewer-store";

// How often an open link checks it is still open: a revoked link closes
// within this, an expired one on the minute.
const RECHECK_MS = 10 * 60 * 1000;
const TICK_MS = 60 * 1000;

// Loads a read-only link's copy into the same stores members use, so every
// screen works as usual. The copy is read again now and then, so a revoked
// link closes on screens already open.
export function useShareSync(
  shareId: string | null,
  repository: ShareRepository = shareRepository,
): void {
  useEffect(() => {
    if (!shareId) return;
    const viewer = useViewerStore.getState();
    viewer.setStatus("loading");
    let current = true;
    let lastLoad = 0;
    // Once closed it stays closed: nothing is read again. Only called
    // after the timer below has started.
    const close = () => {
      clearInterval(timer);
      useTripStore.getState().reset();
      usePlanStore.getState().reset();
      useViewerStore.getState().setStatus("closed");
    };

    const load = () => {
      lastLoad = Date.now();
      repository.load(shareId).then(
        (opened) => {
          if (!current) return;
          if (!opened) return close();
          const now = new Date();
          const data = sharedTripData(opened.trip, now);
          const trip = useTripStore.getState();
          for (const name of TRIP_COLLECTIONS)
            trip.setCollection(name, data[name]);
          usePlanStore.getState().setItems(opened.trip.items);
          useViewerStore.getState().open(opened.share);
        },
        () => {
          // Offline or failing: whatever is showing stays until it expires.
          if (current && useViewerStore.getState().status === "loading")
            useViewerStore.getState().setStatus("failed");
        },
      );
    };

    load();
    const timer = setInterval(() => {
      const share = useViewerStore.getState().share;
      if (share && shareStatus(share, new Date()) !== "active") close();
      else if (Date.now() - lastLoad >= RECHECK_MS) load();
    }, TICK_MS);

    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [shareId, repository]);
}
