import { Suspense } from "react";

import { DayScreen } from "@/components/day-screen";

// One static page for every day: the date is in ?date=, read in the
// browser, so days added in Settings work without a new build.
export default function DayPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 md:max-w-[100rem] md:px-6 lg:px-8 lg:py-8">
      <Suspense fallback={null}>
        <DayScreen />
      </Suspense>
    </main>
  );
}
