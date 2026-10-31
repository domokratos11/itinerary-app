"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { DayPlan } from "@/components/day-plan";
import { hotelsForDay } from "@/domain/plan";
import { endpointFor } from "@/domain/trip";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { daysHref } from "@/lib/links";
import { useCitiesById, useTrip, useTripDays } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

// /day/?date=YYYY-MM-DD. The day, its hotels and reservations come from the
// live trip, so a change to the stays shows here at once.
export function DayScreen() {
  const date = useSearchParams().get("date") ?? "";
  const tripId = useTripId();
  const trip = useTrip();
  const days = useTripDays();
  const citiesById = useCitiesById();
  const day = days.find((d) => d.date === date);

  if (!day) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t("day.notFound")}</h1>
        <p className="text-sm text-muted-foreground">
          {date ? t("day.notATripDay", { date }) : t("day.noDate")}
        </p>
        <Link href={daysHref(tripId)} className="text-sm underline">
          {t("common.backToDays")}
        </Link>
      </div>
    );
  }

  const { start, end } = hotelsForDay(date, trip.stays);
  return (
    <DayPlan
      date={date}
      label={formatDayLabel(date)}
      cityNames={day.cityIds.map((id) => citiesById.get(id)?.name ?? id)}
      cityIds={day.cityIds}
      start={endpointFor(start, t)}
      end={endpointFor(end, t)}
      reservations={trip.reservations.filter((r) => r.date === date)}
    />
  );
}
