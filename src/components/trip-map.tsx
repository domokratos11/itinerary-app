"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Maximize } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MapsError,
  type MapLine,
  type MapPin,
  type MapsErrorKind,
  type MapView,
} from "@/domain/maps-service";
import type { MessageKey } from "@/domain/i18n";
import { t } from "@/lib/i18n";
import { mapsService } from "@/lib/maps-service-instance";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

const MESSAGE: Record<MapsErrorKind, MessageKey> = {
  "not-configured": "map.notConfigured",
  offline: "map.offline",
  quota: "map.quota",
  failed: "map.failed",
};

type Props = {
  pins: MapPin[];
  lines?: MapLine[];
  onPinClick?: (id: string) => void;
  className?: string;
  // Shown under the map, such as how many places have no pin yet.
  note?: string | null;
  // A pin to centre on. A new object each time someone asks, so asking for
  // the same pin twice still moves the map.
  focus?: MapFocus | null;
  // Anything shown over the map's bottom-left corner, such as a legend.
  overlay?: React.ReactNode;
};

export type MapFocus = { id: string };

const NO_LINES: MapLine[] = [];

// Google's map through MapsService. The script loads when this first mounts,
// so it is only rendered once someone opens the map.
export function TripMap({
  pins,
  lines = NO_LINES,
  onPinClick,
  className,
  note,
  focus = null,
  overlay,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<MapView | null>(null);
  const latest = useRef({ pins, lines, onPinClick, focus });
  const [ready, setReady] = useState(false);
  const online = useOnline();
  const { resolvedTheme } = useTheme();
  const scheme = resolvedTheme === "dark" ? "dark" : "light";
  const [failure, setFailure] = useState<MapsErrorKind | null>(null);
  const configured = mapsService.isConfigured();

  useEffect(() => {
    latest.current = { pins, lines, onPinClick, focus };
  });

  // Pins are rebuilt on every render of the screen; redraw only when they
  // actually differ, so the map doesn't flicker.
  const drawn = JSON.stringify([pins, lines]);
  useEffect(() => {
    view.current?.update(latest.current.pins, latest.current.lines);
  }, [drawn]);

  // After the redraw above, and again once a new map is ready (a phone
  // switching to the map tab mounts one just for this).
  useEffect(() => {
    if (focus) view.current?.focus(focus.id);
  }, [focus, ready]);

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
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!stopped)
          setFailure(error instanceof MapsError ? error.kind : "failed");
      });
    return () => {
      stopped = true;
      created?.destroy();
      view.current = null;
      setReady(false);
    };
  }, [configured, online, scheme]);

  const problem: MapsErrorKind | null = !configured
    ? "not-configured"
    : !online
      ? "offline"
      : failure;

  return (
    <div className="flex h-full flex-col gap-1.5">
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
            {t(MESSAGE[problem])}
          </p>
        )}
        {!problem && ready && pins.length > 0 && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 shadow-md"
            aria-label={t("map.fit")}
            title={t("map.fit")}
            onClick={() => view.current?.fit()}
          >
            <Maximize />
          </Button>
        )}
        {!problem && overlay && (
          <div className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)]">
            {overlay}
          </div>
        )}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
