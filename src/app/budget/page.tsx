import { Suspense } from "react";

import { BudgetScreen } from "@/components/budget-screen";

export default function BudgetPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 md:max-w-[100rem] md:px-6 lg:px-8 lg:py-8">
      <Suspense fallback={null}>
        <BudgetScreen />
      </Suspense>
    </main>
  );
}
