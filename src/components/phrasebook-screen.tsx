"use client";

import { useEffect, useRef, useState } from "react";

import { Languages } from "lucide-react";
import Link from "next/link";

import { NumberHelper } from "@/components/number-helper";
import { Button } from "@/components/ui/button";
import { BASE_PATH } from "@/lib/base-path";
import { t } from "@/lib/i18n";
import {
  PHRASEBOOK_FULLSCREEN_MESSAGE,
  PHRASEBOOK_GUIDE_PATH,
} from "@/lib/phrasebook";
import { pageHref } from "@/lib/links";
import { useTripId } from "@/lib/use-trip-id";
import { cn } from "@/lib/utils";

// Whether a message is the guide in our own frame saying it shows a phrase
// full screen (open) or not any more.
function fullscreenMessage(
  event: MessageEvent,
  frame: HTMLIFrameElement | null,
): boolean | null {
  if (event.origin !== window.location.origin) return null;
  if (!frame || event.source !== frame.contentWindow) return null;
  const data: unknown = event.data;
  if (typeof data !== "object" || data === null) return null;
  const { type, open } = data as { type?: unknown; open?: unknown };
  if (type !== PHRASEBOOK_FULLSCREEN_MESSAGE) return null;
  return open === true;
}

// The Japanese phrasebook inside the app's frame. The guide itself is a
// static page (scripts/phrasebook-import.ts) shown in an iframe from the same
// site: it takes the app's colours, light or dark and fonts from this page,
// keeps its own topics, search, saved phrases and audio, and is precached
// for offline use. It fills the space between the header and, on phones, the
// tab bar, and scrolls on its own. While the guide shows a phrase to staff,
// the frame covers the whole screen, header and tab bar included. The
// number helper sits over its bottom corner.
export function PhrasebookScreen() {
  const frame = useRef<HTMLIFrameElement>(null);
  const tripId = useTripId();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const open = fullscreenMessage(event, frame.current);
      if (open !== null) setFullscreen(open);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <main
      className={cn(
        "flex w-full flex-col bg-background",
        fullscreen
          ? "fixed inset-0 z-50 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
          : "relative h-[calc(100svh-3.5rem-4rem-env(safe-area-inset-bottom))] md:h-[calc(100svh-3.5rem)]",
      )}
    >
      <iframe
        ref={frame}
        src={`${BASE_PATH}${PHRASEBOOK_GUIDE_PATH}`}
        title={t("phrasebook.frameTitle")}
        className="min-h-0 w-full flex-1 border-0 bg-background"
      />
      <div
        className={cn(
          "absolute right-4 bottom-4 z-10 flex gap-2 md:bottom-8",
          fullscreen && "hidden",
        )}
      >
        <Button asChild variant="secondary" className="rounded-full shadow-lg">
          <Link href={pageHref("/kanji/", tripId)}>
            <Languages data-icon="inline-start" />
            {t("nav.kanji")}
          </Link>
        </Button>
        <NumberHelper />
      </div>
    </main>
  );
}
