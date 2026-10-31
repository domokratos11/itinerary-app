"use client";

import { useEffect, useState } from "react";

import type { DayLeg } from "@/domain/legs";
import type { WalkingLeg } from "@/domain/maps-service";
import { mapsService } from "@/lib/maps-service-instance";
import { useOnline } from "@/lib/use-online";

// Real walking routes for a day's short legs, by leg key. Kept in memory only,
// as Google's terms require. Offline, before the map is set up, or past the
// daily cap this stays empty and the day shows straight-line distances.
export function useWalkingLegs(legs: DayLeg[]): Map<string, WalkingLeg> {
  const online = useOnline();
  const [found, setFound] = useState<Map<string, WalkingLeg>>(new Map());
  const configured = mapsService.isConfigured();

  const wanted = legs.flatMap((leg) =>
    leg.kind === "walk" && leg.from && leg.to
      ? [{ key: leg.key, from: leg.from, to: leg.to }]
      : [],
  );
  const signature = JSON.stringify(wanted);

  useEffect(() => {
    if (!configured || !online) return;
    let stopped = false;
    const requests = JSON.parse(signature) as typeof wanted;
    Promise.allSettled(
      requests.map((leg) => mapsService.walkingLeg(leg.from, leg.to)),
    ).then((results) => {
      if (stopped) return;
      const next = new Map<string, WalkingLeg>();
      results.forEach((result, index) => {
        if (result.status === "fulfilled")
          next.set(requests[index].key, result.value);
      });
      setFound(next);
    });
    return () => {
      stopped = true;
    };
  }, [configured, online, signature]);

  return found;
}
