"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

// What screens import for charts. The recharts charts load on first use,
// so the library stays out of every page's first load; the service worker
// precaches their chunks, so they still open offline. Each placeholder has
// the chart's own size, so nothing moves when it arrives.

export { BarList, SeriesLegend, type Series } from "@/components/chart-parts";

export const DonutChart = dynamic(
  () => import("@/components/charts").then((m) => m.DonutChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
        <Skeleton className="mx-auto aspect-square w-full max-w-52 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
    ),
  },
);

export const BudgetGauge = dynamic(
  () => import("@/components/charts").then((m) => m.BudgetGauge),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="mx-auto aspect-square w-full max-w-52 rounded-full" />
    ),
  },
);

export const ColumnChart = dynamic(
  () => import("@/components/charts").then((m) => m.ColumnChart),
  { ssr: false, loading: () => <Skeleton className="h-44 w-full" /> },
);

export const StackedColumnChart = dynamic(
  () => import("@/components/charts").then((m) => m.StackedColumnChart),
  { ssr: false, loading: () => <Skeleton className="h-52 w-full" /> },
);
