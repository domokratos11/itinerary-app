"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDayLabel } from "@/lib/format-day";
import { cityHref, dayHref } from "@/lib/links";
import { usePlanStore } from "@/lib/plan-store";
import { todayInTokyo } from "@/lib/tokyo-date";
import { useCitiesById, useTripDays } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

const FALLBACK_COLOR = "#64748b";

// The trip's days, derived from the live stays. "Today" scrolls to today's
// card; before the trip it goes to the first day, after it to the last.
export function TripDays() {
  const items = usePlanStore((s) => s.items);
  const days = useTripDays();
  const citiesById = useCitiesById();
  const tripId = useTripId();

  const stopsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.status === "removed") continue;
      counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  function jumpToToday() {
    if (days.length === 0) return;
    const today = todayInTokyo();
    const first = days[0].date;
    const last = days[days.length - 1].date;
    const target = today < first ? first : today > last ? last : today;
    document
      .getElementById(`day-${target}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Days</h2>
        <Button size="sm" variant="outline" onClick={jumpToToday}>
          Today
        </Button>
      </div>
      {days.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No stays yet. Add one in Settings to create the trip&apos;s days.
        </p>
      )}
      {days.map((day) => {
        const stops = stopsByDate.get(day.date) ?? 0;
        return (
          <Card key={day.date} id={`day-${day.date}`} className="scroll-mt-4">
            <CardHeader>
              <CardTitle className="text-base">
                <Link
                  href={dayHref(day.date, tripId)}
                  className="underline-offset-4 hover:underline"
                >
                  {formatDayLabel(day.date)}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {day.cityIds.map((id) => {
                const city = citiesById.get(id);
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="gap-1.5"
                    asChild
                  >
                    <Link href={cityHref(id, tripId)}>
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor: city?.color ?? FALLBACK_COLOR,
                        }}
                      />
                      {city?.name ?? id}
                    </Link>
                  </Badge>
                );
              })}
              <span className="ml-auto text-sm text-muted-foreground">
                {stops === 0
                  ? "No stops yet"
                  : `${stops} ${stops === 1 ? "stop" : "stops"}`}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
