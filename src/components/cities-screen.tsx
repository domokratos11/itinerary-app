"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { cityHref, pageHref } from "@/lib/links";
import { usePlanStore } from "@/lib/plan-store";
import { useTrip } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

// Every city in trip order, with its dates and how much of it is planned.
export function CitiesScreen() {
  const tripId = useTripId();
  const trip = useTrip();
  const items = usePlanStore((s) => s.items);
  const planned = useMemo(
    () =>
      new Set(
        items.filter((i) => i.status !== "removed").map((i) => i.placeId),
      ),
    [items],
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("cities.title")}</h1>
      {trip.cities.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("cities.none")}{" "}
          <Link
            href={pageHref("/settings/", tripId, { tab: "cities" })}
            className="underline"
          >
            {t("cities.addInSettings")}
          </Link>
          .
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {trip.cities.map((city) => {
          const stays = trip.stays.filter((s) => s.cityId === city.id);
          const places = trip.places.filter((p) => p.cityId === city.id);
          const inPlan = places.filter((p) => planned.has(p.id)).length;
          return (
            <li key={city.id}>
              <Link href={cityHref(city.id, tripId)} className="block h-full">
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span
                        aria-hidden
                        className="size-3 rounded-full"
                        style={{ backgroundColor: city.color }}
                      />
                      {city.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    {stays.map((s) => (
                      <span key={s.id} className="text-muted-foreground">
                        {formatDayLabel(s.checkIn)} →{" "}
                        {formatDayLabel(s.checkOut)}
                      </span>
                    ))}
                    <span className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {t("common.places", { count: places.length })}
                      </Badge>
                      <Badge variant="outline">
                        {t("cities.inPlan", { count: inPlan })}
                      </Badge>
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
