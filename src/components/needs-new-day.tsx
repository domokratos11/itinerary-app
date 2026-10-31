"use client";

import { useMemo } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { itemsForDay } from "@/domain/plan";
import { strandedItems } from "@/domain/trip";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { placeItem } from "@/lib/plan-actions";
import { usePlanStore } from "@/lib/plan-store";
import { usePlacesById, useTrip, useTripDays } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

// Stops left without a valid day after the stays changed, each with a
// picker of the days its city now covers.
export function NeedsNewDay() {
  const tripId = useTripId();
  const items = usePlanStore((s) => s.items);
  const trip = useTrip();
  const days = useTripDays();
  const placesById = usePlacesById();
  const stranded = useMemo(
    () => strandedItems(items, days, trip.places),
    [items, days, trip.places],
  );

  if (stranded.length === 0) return null;

  function move(index: number, date: string) {
    if (!tripId) return;
    const { item } = stranded[index];
    const dayItems = itemsForDay(items, date);
    placeItem(tripId, item, date, dayItems.length, dayItems).catch(() =>
      toast.error(t("common.refused")),
    );
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-base">{t("misc.needsNewDay")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {t("misc.needsNewDayBody")}
        </p>
        <ul className="flex flex-col gap-2">
          {stranded.map(({ item, reason }, index) => {
            const place = placesById.get(item.placeId);
            const options = days.filter(
              (d) => !place || d.cityIds.includes(place.cityId),
            );
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {place?.name ?? item.placeId}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDayLabel(item.date)} ·{" "}
                    {reason === "outside-trip"
                      ? t("misc.noLongerTripDay")
                      : t("misc.cityNotOnDay")}
                  </span>
                </span>
                <Select onValueChange={(date) => move(index, date)}>
                  <SelectTrigger size="sm" className="w-44">
                    <SelectValue placeholder={t("common.moveTo")} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((d) => (
                      <SelectItem key={d.date} value={d.date}>
                        {formatDayLabel(d.date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
