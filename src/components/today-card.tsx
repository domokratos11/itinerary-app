"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight, Navigation } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tripPhase } from "@/domain/days";
import {
  directionsUrl,
  itemsForDay,
  nextStop,
  placeLocation,
  stopTimes,
} from "@/domain/plan";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { dayHref } from "@/lib/links";
import { usePlanStore } from "@/lib/plan-store";
import { todayInTokyo } from "@/lib/tokyo-date";
import { useCitiesById, usePlacesById, useTripDays } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

const noopSubscribe = () => () => {};

// Today in Japan, known only in the browser (the page is built ahead).
function useTodayInTokyo(): string | null {
  return useSyncExternalStore(noopSubscribe, todayInTokyo, () => null);
}

// Top of home. During the trip: today's day and the next stop with
// directions from where you are. Before it: a countdown.
export function TodayCard() {
  const today = useTodayInTokyo();
  const tripId = useTripId();
  const days = useTripDays();
  const items = usePlanStore((s) => s.items);
  const placesById = usePlacesById();
  const citiesById = useCitiesById();
  if (!today) return null;

  const phase = tripPhase(today, days);
  if (phase.phase === "after") return null;

  if (phase.phase === "before") {
    const firstCity = citiesById.get(days[0].cityIds[0])?.name;
    return (
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="flex items-center justify-between gap-3 py-5">
          <div>
            <p className="font-heading text-3xl font-semibold">
              {t("home.daysLeft", { count: phase.daysLeft })}
            </p>
            <p className="text-sm opacity-90">
              {firstCity
                ? t("home.untilFirstDay", {
                    day: formatDayLabel(phase.first),
                    city: firstCity,
                  })
                : t("home.untilFirstDayNoCity", {
                    day: formatDayLabel(phase.first),
                  })}
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={dayHref(phase.first, tripId)}>
              {t("home.dayOne")}
              <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stops = itemsForDay(items, phase.date);
  const next = nextStop(stops);
  const place = next ? placesById.get(next.placeId) : undefined;
  const times = next ? stopTimes(next, place) : null;
  const done = stops.filter((s) => s.status !== "planned").length;
  const day = days.find((d) => d.date === phase.date);

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2">
          <span className="text-lg">
            {t("home.todayDay", { day: formatDayLabel(phase.date) })}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {day?.cityIds
              .map((id) => citiesById.get(id)?.name ?? id)
              .join(" → ")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {place && next ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              {times
                ? t("home.nextStopAt", { time: times.start })
                : t("home.nextStop")}
            </span>
            <span className="text-lg font-medium">{place.name}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {stops.length === 0
              ? t("home.nothingToday")
              : t("home.allDoneToday")}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {place && (
            <Button asChild>
              <a
                href={directionsUrl(placeLocation(place))}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation />
                {t("home.goThere")}
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={dayHref(phase.date, tripId)}>
              {t("home.openToday", { done, total: stops.length })}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
