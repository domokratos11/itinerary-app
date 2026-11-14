"use client";

import { BASE_PATH } from "@/lib/base-path";
import { t } from "@/lib/i18n";
import { PHRASEBOOK_GUIDE_PATH } from "@/lib/phrasebook";

// The Japanese phrasebook inside the app's frame. The guide itself is a
// static page (scripts/phrasebook-import.ts) shown in an iframe from the same
// site: it takes the app's colours, light or dark and fonts from this page,
// keeps its own topics, search, saved phrases and audio, and is precached
// for offline use. It fills the space between the header and, on phones, the
// tab bar, and scrolls on its own.
export function PhrasebookScreen() {
  return (
    <main className="flex h-[calc(100svh-3.5rem-4rem-env(safe-area-inset-bottom))] w-full flex-col bg-background md:h-[calc(100svh-3.5rem)]">
      <iframe
        src={`${BASE_PATH}${PHRASEBOOK_GUIDE_PATH}`}
        title={t("phrasebook.frameTitle")}
        className="min-h-0 w-full flex-1 border-0 bg-background"
      />
    </main>
  );
}
