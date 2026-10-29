"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanStore } from "@/lib/plan-store";
import { todayInTokyo } from "@/lib/tokyo-date";

export type DayView = {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Thu, Dec 17", formatted on the server
  cities: { id: string; name: string; color: string }[];
};

// Scrolls to today's card. Before the trip it goes to the first day, and
// after the trip to the last day.
export function TripDays({ days }: { days: DayView[] }) {
  const items = usePlanStore((s) => s.items);

  const stopsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.status === "removed") continue;
      counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  function jumpToToday() {
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
      {days.map((day) => {
        const stops = stopsByDate.get(day.date) ?? 0;
        return (
          <Card key={day.date} id={`day-${day.date}`} className="scroll-mt-4">
            <CardHeader>
              <CardTitle className="text-base">{day.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {day.cities.map((city) => (
                <Badge key={city.id} variant="secondary" className="gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: city.color }}
                  />
                  {city.name}
                </Badge>
              ))}
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
