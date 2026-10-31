"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { BedDouble } from "lucide-react";

import { Button } from "@/components/ui/button";
import { groupDaysByStay } from "@/domain/trip";
import { intlLocale, t } from "@/lib/i18n";
import { cityHref, dayHref, pageHref } from "@/lib/links";
import { usePlanStore } from "@/lib/plan-store";
import { todayInTokyo } from "@/lib/tokyo-date";
import { useCitiesById, useTrip, useTripDays } from "@/lib/trip-store";
import { cn } from "@/lib/utils";
import { useTripId } from "@/lib/use-trip-id";

const FALLBACK_COLOR = "#64748b";
const noopSubscribe = () => () => {};

function dayParts(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString(intlLocale(), { ...o, timeZone: "UTC" });
  return {
    weekday: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
  };
}

// The trip's days, grouped by the hotel of each night, from the live stays.
// A list on phones, a calendar-like grid on wider screens. "Today" scrolls
// to today's card; before the trip to the first day, after it to the last.
export function TripDays() {
  const items = usePlanStore((s) => s.items);
  const trip = useTrip();
  const days = useTripDays();
  const citiesById = useCitiesById();
  const tripId = useTripId();
  const today = useSyncExternalStore(noopSubscribe, todayInTokyo, () => null);
  const groups = useMemo(
    () => groupDaysByStay(days, trip.stays),
    [days, trip.stays],
  );

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
    const now = todayInTokyo();
    const first = days[0].date;
    const last = days[days.length - 1].date;
    const target = now < first ? first : now > last ? last : now;
    document
      .getElementById(`day-${target}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("home.daysHeading")}</h2>
        <Button size="sm" variant="outline" onClick={jumpToToday}>
          {t("common.today")}
        </Button>
      </div>
      {days.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("home.noStaysBefore")}{" "}
          <Link href={pageHref("/settings/", tripId)} className="underline">
            {t("home.noStaysLink")}
          </Link>{" "}
          {t("home.noStaysAfter")}
        </p>
      )}
      {groups.map((group) => {
        const city = group.stay ? citiesById.get(group.stay.cityId) : null;
        return (
          <div key={group.days[0].date} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: city?.color ?? FALLBACK_COLOR }}
              />
              {group.stay && city ? (
                <Link
                  href={cityHref(city.id, tripId)}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {city.name}
                </Link>
              ) : (
                <span className="font-medium text-destructive">
                  {t("home.noHotel")}
                </span>
              )}
              {group.stay && (
                <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                  <BedDouble className="size-3.5 shrink-0" />
                  <span className="truncate">{group.stay.hotelName}</span>
                </span>
              )}
            </div>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.days.map((day) => {
                const stops = stopsByDate.get(day.date) ?? 0;
                const { weekday, day: num, month } = dayParts(day.date);
                const isToday = day.date === today;
                return (
                  <li
                    key={day.date}
                    id={`day-${day.date}`}
                    className="scroll-mt-20"
                  >
                    <Link
                      href={dayHref(day.date, tripId)}
                      prefetch={false}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-muted/40",
                        isToday && "border-primary ring-2 ring-primary/20",
                      )}
                    >
                      <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1 leading-none">
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {month}
                        </span>
                        <span className="font-heading text-xl font-semibold tabular-nums">
                          {num}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm font-medium">
                          {weekday}
                          {isToday && (
                            <span className="ml-2 text-xs text-primary">
                              {t("common.today")}
                            </span>
                          )}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          {day.cityIds.map((id) => (
                            <span key={id} className="flex items-center gap-1">
                              <span
                                aria-hidden
                                className="size-1.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    citiesById.get(id)?.color ?? FALLBACK_COLOR,
                                }}
                              />
                              {citiesById.get(id)?.name ?? id}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums",
                          stops === 0
                            ? "text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {stops === 0
                          ? "—"
                          : t("common.stops", { count: stops })}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
