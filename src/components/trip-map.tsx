"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Expand, Maximize, Shrink } from "lucide-react";

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
  // Controls over the top-left corner, still there in full screen.
  toolbar?: React.ReactNode;
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
  toolbar,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  // Full screen is the same box grown over the page, so the map isn't made
  // again (a new map is a new billed load) and works on iPhones too.
  const [expanded, setExpanded] = useState(false);
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

  // Escape closes it, the page behind doesn't scroll, and the pins are
  // fitted again to the new size.
  useEffect(() => {
    const frame = requestAnimationFrame(() => view.current?.fit());
    if (!expanded) return () => cancelAnimationFrame(frame);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const problem: MapsErrorKind | null = !configured
    ? "not-configured"
    : !online
      ? "offline"
      : failure;

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded || undefined}
        aria-label={expanded ? t("map.expand") : undefined}
        data-expanded={expanded || undefined}
        className={cn(
          "relative overflow-hidden rounded-xl border bg-muted",
          className,
          expanded &&
            "fixed inset-0 z-50 h-auto! min-h-0 rounded-none border-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
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
        {!problem && (
          <div
            className={cn(
              "absolute top-2 right-2 flex flex-col gap-2",
              expanded && "top-[calc(0.75rem+env(safe-area-inset-top))] right-3",
            )}
          >
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="shadow-md"
              aria-label={expanded ? t("map.shrink") : t("map.expand")}
              title={expanded ? t("map.shrink") : t("map.expand")}
              aria-pressed={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? <Shrink /> : <Expand />}
            </Button>
            {ready && pins.length > 0 && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="shadow-md"
                aria-label={t("map.fit")}
                title={t("map.fit")}
                onClick={() => view.current?.fit()}
              >
                <Maximize />
              </Button>
            )}
          </div>
        )}
        {!problem && toolbar && (
          <div
            className={cn(
              "absolute top-2 left-2 max-w-[calc(100%-4rem)]",
              expanded && "top-[calc(0.75rem+env(safe-area-inset-top))] left-3",
            )}
          >
            {toolbar}
          </div>
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
