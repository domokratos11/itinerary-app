import { Suspense } from "react";

import { CityScreen } from "@/components/city-screen";

// One static page for every city: the city is in ?id=, read in the browser,
// so cities added in Settings work without a new build.
export default function CityPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 md:max-w-[100rem] md:px-6 lg:px-8 lg:py-8">
      <Suspense fallback={null}>
        <CityScreen />
      </Suspense>
    </main>
  );
}
