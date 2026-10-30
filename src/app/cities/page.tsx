import { Suspense } from "react";

import { CitiesScreen } from "@/components/cities-screen";

export default function CitiesPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 md:max-w-5xl lg:px-8">
      <Suspense fallback={null}>
        <CitiesScreen />
      </Suspense>
    </main>
  );
}
