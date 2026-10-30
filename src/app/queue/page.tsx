import { Suspense } from "react";

import { QueuePanel } from "@/components/queue-panel";

export default function QueuePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 md:max-w-2xl">
      <h1 className="text-2xl font-semibold">Queue</h1>
      <p className="text-sm text-muted-foreground">
        Paste a Google Maps link to save a place for later, then assign it to a
        day.
      </p>
      <Suspense fallback={null}>
        <QueuePanel />
      </Suspense>
    </main>
  );
}
