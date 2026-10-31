"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

import {
  MapsError,
  type MapLine,
  type MapPin,
  type MapsErrorKind,
  type MapView,
} from "@/domain/maps-service";
import { mapsService } from "@/lib/maps-service-instance";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

const MESSAGE: Record<MapsErrorKind, string> = {
  "not-configured": "The map isn't set up yet.",
  offline:
    "You're offline. The map comes back with signal; the list still works.",
  quota: "The map reached its daily limit. It will be back tomorrow.",
  failed: "The map couldn't load. The list still works.",
};

type Props = {
  pins: MapPin[];
  lines?: MapLine[];
  onPinClick?: (id: string) => void;
  className?: string;
  // Shown under the map, such as how many places have no pin yet.
  note?: string | null;
};

const NO_LINES: MapLine[] = [];

// Google's map through MapsService. The script loads when this first mounts,
// so it is only rendered once someone opens the map.
export function TripMap({
  pins,
  lines = NO_LINES,
  onPinClick,
  className,
  note,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<MapView | null>(null);
  const latest = useRef({ pins, lines, onPinClick });
  const online = useOnline();
  const { resolvedTheme } = useTheme();
  const scheme = resolvedTheme === "dark" ? "dark" : "light";
  const [failure, setFailure] = useState<MapsErrorKind | null>(null);
  const configured = mapsService.isConfigured();

  useEffect(() => {
    latest.current = { pins, lines, onPinClick };
    view.current?.update(pins, lines);
  }, [pins, lines, onPinClick]);

  // The colour scheme is fixed when a Google map is created, so a theme change
  // starts a new one. Coming back online tries again after a failed start.
  useEffect(() => {
    const element = container.current;
    if (!element || !configured || !online) return;
    let stopped = false;
    let created: MapView | null = null;
    mapsService
      .createMap(element, {
        colorScheme: scheme,
        onPinClick: (id) => latest.current.onPinClick?.(id),
        onFailure: (kind) => {
          if (!stopped) setFailure(kind);
        },
      })
      .then((map) => {
        if (stopped) return map.destroy();
        created = map;
        view.current = map;
        setFailure(null);
        map.update(latest.current.pins, latest.current.lines);
      })
      .catch((error: unknown) => {
        if (!stopped)
          setFailure(error instanceof MapsError ? error.kind : "failed");
      });
    return () => {
      stopped = true;
      created?.destroy();
      view.current = null;
    };
  }, [configured, online, scheme]);

  const problem: MapsErrorKind | null = !configured
    ? "not-configured"
    : !online
      ? "offline"
      : failure;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-muted",
          className,
        )}
      >
        <div
          ref={container}
          className={cn("size-full", problem && "invisible")}
        />
        {problem && (
          <p
            role="status"
            className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground"
          >
            {MESSAGE[problem]}
          </p>
        )}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
