import { Suspense } from "react";

import { QueueIntro, QueuePanel } from "@/components/queue-panel";

export default function QueuePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 md:max-w-2xl">
      <QueueIntro />
      <Suspense fallback={null}>
        <QueuePanel />
      </Suspense>
    </main>
  );
}
