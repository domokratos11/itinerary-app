"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plane, Search, Sparkles } from "lucide-react";

import { calendarWeeks, stayBands } from "@/domain/calendar";
import type { TripDay } from "@/domain/days";
import { flightsOnDay } from "@/domain/flights";
import { tint } from "@/domain/taxonomy";
import { intlLocale, t } from "@/lib/i18n";
import { dayHref } from "@/lib/links";
import { useCitiesById, useTrip } from "@/lib/trip-store";
import { useDayResearch } from "@/lib/use-day-research";
import { useDaysWeather } from "@/lib/use-weather";
import { WeatherBadge } from "@/components/day-weather";
import { cn } from "@/lib/utils";
import { useTripId } from "@/lib/use-trip-id";

const FALLBACK_COLOR = "#64748b";
// Any Monday; the header names a week starting from it.
const A_MONDAY = Date.UTC(2024, 0, 1);

function weekdayNames(): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(A_MONDAY + i * 86_400_000).toLocaleDateString(intlLocale(), {
      weekday: "short",
      timeZone: "UTC",
    }),
  );
}

function monthDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(intlLocale(), {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// The trip as a Monday-first calendar, one row per week and no break between
// December and January. Each hotel is a coloured bar under the nights spent
// there. Compact on phones (number, count, a thin bar), roomier from lg.
export function TripCalendar({
  days,
  stopsByDate,
  today,
}: {
  days: TripDay[];
  stopsByDate: Map<string, number>;
  today: string | null;
}) {
  const trip = useTrip();
  const citiesById = useCitiesById();
  const tripId = useTripId();
  const weeks = useMemo(() => calendarWeeks(days), [days]);
  const research = useDayResearch(tripId);
  const researchByDate = useMemo(
    () => new Map(research.map((r) => [r.date, r.status])),
    [research],
  );
  const holidays = useMemo(
    () => new Map(trip.holidays.map((h) => [h.date, h])),
    [trip.holidays],
  );
  const names = weekdayNames();
  const outlook = useDaysWeather(
    useMemo(
      () =>
        days.map((d) => ({
          date: d.date,
          city: citiesById.get(d.cityIds[0] ?? "")?.name ?? null,
        })),
      [days, citiesById],
    ),
  );

  return (
    <div className="flex flex-col gap-1" role="table">
      <div role="row" className="grid grid-cols-7 gap-1">
        {names.map((name) => (
          <span
            key={name}
            role="columnheader"
            className="text-center text-[11px] font-medium text-muted-foreground uppercase"
          >
            {name}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div
          key={week[0].date}
          role="row"
          className="grid grid-cols-7 [grid-template-rows:auto] gap-1"
        >
          {week.map((cell, column) => {
            const style = { gridColumnStart: column + 1, gridRowStart: 1 };
            const number = Number(cell.date.slice(8));
            const shade = cell.monthIndex % 2 === 1 && "bg-muted/50";
            if (!cell.day)
              return (
                <span
                  key={cell.date}
                  role="cell"
                  style={style}
                  className={cn(
                    "min-h-16 rounded-lg border border-dashed p-1.5 text-xs text-muted-foreground/60 tabular-nums lg:min-h-28",
                    shade,
                  )}
                >
                  {number}
                </span>
              );
            const stops = stopsByDate.get(cell.date) ?? 0;
            const flights = flightsOnDay(trip.flights, cell.date);
            const holiday = holidays.get(cell.date);
            const isToday = cell.date === today;
            const researched = researchByDate.get(cell.date);
            const cities = cell.day.cityIds
              .map((id) => citiesById.get(id)?.name ?? id)
              .join(" → ");
            return (
              <Link
                key={cell.date}
                id={`day-${cell.date}`}
                role="cell"
                href={dayHref(cell.date, tripId)}
                prefetch={false}
                style={style}
                aria-label={[
                  monthDay(cell.date),
                  cities,
                  stops > 0 ? t("common.stops", { count: stops }) : null,
                  holiday?.name ?? null,
                  researched === "requested"
                    ? t("dayResearch.badgeRequested")
                    : researched === "ready"
                      ? t("dayResearch.badgeReady")
                      : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
                className={cn(
                  "flex min-h-16 scroll-mt-24 flex-col gap-0.5 rounded-lg border bg-card p-1.5 pb-4 transition-colors hover:border-primary/50 hover:bg-muted/40 lg:min-h-28 lg:gap-1 lg:p-2 lg:pb-8",
                  shade,
                  isToday && "border-now ring-2 ring-now/30",
                )}
              >
                <span className="flex items-baseline justify-between gap-1">
                  <span
                    className={cn(
                      "font-heading text-sm font-semibold tabular-nums lg:text-lg",
                      isToday && "text-now",
                    )}
                  >
                    {cell.showMonth ? (
                      <>
                        <span className="hidden lg:inline">
                          {monthDay(cell.date)}
                        </span>
                        <span className="lg:hidden">{number}</span>
                      </>
                    ) : (
                      number
                    )}
                  </span>
                  <WeatherBadge outlook={outlook.get(cell.date)} />
                  {holiday && (
                    <span
                      aria-hidden
                      title={holiday.name}
                      className="size-1.5 shrink-0 rounded-full bg-destructive"
                    />
                  )}
                </span>
                {cell.showMonth && (
                  <span className="text-[10px] leading-none font-medium text-primary uppercase lg:hidden">
                    {new Date(`${cell.date}T00:00:00Z`).toLocaleDateString(
                      intlLocale(),
                      { month: "short", timeZone: "UTC" },
                    )}
                  </span>
                )}
                <span className="hidden truncate text-xs text-muted-foreground lg:block">
                  {cities}
                </span>
                {holiday && (
                  <span className="hidden truncate text-xs text-destructive lg:block">
                    {holiday.name}
                  </span>
                )}
                <span className="mt-auto flex items-center gap-1 text-[11px] tabular-nums lg:text-xs">
                  {stops > 0 ? (
                    <span className="font-medium">
                      <span className="lg:hidden">{stops}</span>
                      <span className="hidden lg:inline">
                        {t("common.stops", { count: stops })}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {researched === "requested" && (
                    <Search
                      aria-hidden
                      className="size-3 text-muted-foreground"
                    />
                  )}
                  {researched === "ready" && (
                    <Sparkles aria-hidden className="size-3 text-primary" />
                  )}
                  {flights.length > 0 && (
                    <Plane
                      aria-label={flights.map((f) => f.flightNumber).join(", ")}
                      className="size-3 text-muted-foreground"
                    />
                  )}
                </span>
              </Link>
            );
          })}
          {stayBands(week, trip.stays).map((band) => {
            const color =
              citiesById.get(band.stay.cityId)?.color ?? FALLBACK_COLOR;
            return (
              <span
                key={`${band.stay.cityId}-${band.stay.checkIn}-${band.start}`}
                aria-hidden
                style={{
                  gridColumn: `${band.start + 1} / span ${band.span}`,
                  gridRowStart: 1,
                  backgroundColor: tint(color, 30),
                  borderColor: color,
                }}
                className="pointer-events-none mx-1 mb-1.5 h-1.5 self-end truncate rounded-full border-l-4 lg:h-5 lg:px-1.5 lg:text-[11px] lg:leading-4"
              >
                <span className="hidden lg:inline">{band.stay.hotelName}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
