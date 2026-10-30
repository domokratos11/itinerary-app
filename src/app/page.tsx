import { Suspense } from "react";
import { ExportPlan } from "@/components/export-plan";
import { NeedsNewDay } from "@/components/needs-new-day";
import { TripDates } from "@/components/trip-dates";
import { TripPlanStatus } from "@/components/trip-plan-status";
import { TripDays } from "@/components/trip-days";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// The days, cities and dates come from the live trip in the browser (see
// lib/trip-store); this page is only the static shell around them.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">Japan Trip 2026–27</h1>
          </CardTitle>
          <CardDescription>
            <TripDates />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <TripPlanStatus />
          <div className="flex flex-wrap gap-2">
            <ExportPlan />
          </div>
        </CardContent>
      </Card>
      <Suspense fallback={null}>
        <NeedsNewDay />
      </Suspense>
      <Suspense fallback={null}>
        <TripDays />
      </Suspense>
    </main>
  );
}
