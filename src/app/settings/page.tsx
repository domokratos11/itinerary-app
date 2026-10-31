import { Suspense } from "react";

import { SettingsScreen } from "@/components/settings-screen";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 md:max-w-[100rem] md:px-6 lg:px-8 lg:py-8">
      <Suspense fallback={null}>
        <SettingsScreen />
      </Suspense>
    </main>
  );
}
