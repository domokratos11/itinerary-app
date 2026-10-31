import { Suspense } from "react";
import { ExportTrip } from "@/components/settings-backup";
import { NeedsNewDay } from "@/components/needs-new-day";
import { ResearchNotice } from "@/components/research-notice";
import { TodayCard } from "@/components/today-card";
import { TripDates } from "@/components/trip-dates";
import { TripPlanStatus } from "@/components/trip-plan-status";
import { TripDays } from "@/components/trip-days";
import { TripName } from "@/components/trip-name";
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 md:max-w-[100rem] md:px-6 lg:px-8 lg:py-8">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl">
                <TripName />
              </h1>
            </CardTitle>
            <CardDescription>
              <TripDates />
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <TripPlanStatus />
            <div className="flex flex-wrap gap-2">
              <Suspense fallback={null}>
                <ExportTrip />
              </Suspense>
            </div>
          </CardContent>
        </Card>
        <Suspense fallback={null}>
          <TodayCard />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <NeedsNewDay />
      </Suspense>
      <Suspense fallback={null}>
        <ResearchNotice />
      </Suspense>
      <Suspense fallback={null}>
        <TripDays />
      </Suspense>
    </main>
  );
}
