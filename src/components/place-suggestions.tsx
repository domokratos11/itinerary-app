"use client";

import { Button } from "@/components/ui/button";
import type { PlaceSuggestion } from "@/domain/maps-service";

// Google's suggestions under a name field. Tapping one picks that exact place.
export function PlaceSuggestions({
  suggestions,
  onChoose,
}: {
  suggestions: PlaceSuggestion[];
  onChoose: (suggestion: PlaceSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {suggestions.map((s) => (
        <li key={s.placeId}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChoose(s)}
            className="h-auto w-full flex-col items-start gap-0 py-2 text-left whitespace-normal"
          >
            <span className="font-medium">{s.name}</span>
            {s.detail && (
              <span className="text-xs font-normal text-muted-foreground">
                {s.detail}
              </span>
            )}
          </Button>
        </li>
      ))}
    </ul>
  );
}
