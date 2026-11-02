"use client";

import { useEffect, useState } from "react";

import type { PlaceSuggestion } from "@/domain/maps-service";
import { mapsService } from "@/lib/maps-service-instance";
import { useOnline } from "@/lib/use-online";

const SEARCH_DELAY_MS = 350;
const SEARCH_MIN_LENGTH = 3;

// Google's suggestions for what's typed, when the map is set up and there is
// signal. Without them a name can still be saved, and maps:match finds it later.
export function usePlaceSuggestions(
  input: string,
  enabled: boolean,
): PlaceSuggestion[] {
  const online = useOnline();
  const [found, setFound] = useState<{
    input: string;
    suggestions: PlaceSuggestion[];
  } | null>(null);
  const trimmed = input.trim();
  const search =
    enabled &&
    online &&
    mapsService.isConfigured() &&
    trimmed.length >= SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (!search) return;
    let stopped = false;
    const timer = setTimeout(() => {
      mapsService
        .suggestPlaces(trimmed)
        .then((suggestions) => {
          if (!stopped) setFound({ input: trimmed, suggestions });
        })
        .catch(() => {
          if (!stopped) setFound({ input: trimmed, suggestions: [] });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [search, trimmed]);

  // Answers for an older input are dropped, not shown under the new one.
  return search && found?.input === trimmed ? found.suggestions : [];
}
