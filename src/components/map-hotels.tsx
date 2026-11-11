"use client";

import { BedDouble } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { endpointPoint } from "@/domain/map-pins";
import type { Endpoint } from "@/domain/trip";
import { t } from "@/lib/i18n";

export type HotelsShown = { start: boolean; end: boolean };

export const NO_HOTELS: HotelsShown = { start: false, end: false };

// The day's hotels that can have a pin, and whether they are two different
// ones (a moving day) or the same one morning and night.
export function mapHotels(start: Endpoint | null, end: Endpoint | null) {
  const startPoint = endpointPoint(start);
  const endPoint = endpointPoint(end);
  const two =
    startPoint !== null &&
    endPoint !== null &&
    (startPoint.lat !== endPoint.lat || startPoint.lng !== endPoint.lng);
  return { start: startPoint !== null, end: endPoint !== null, two };
}

// "Show hotel" over the day's map. Off by default, so the map stays on the
// day's stops instead of stretching to a hotel in another city. On a moving
// day it can show either hotel or both.
export function MapHotelsControl({
  start,
  end,
  value,
  onChange,
}: {
  start: Endpoint | null;
  end: Endpoint | null;
  value: HotelsShown;
  onChange: (value: HotelsShown) => void;
}) {
  const hotels = mapHotels(start, end);
  if (!hotels.start && !hotels.end) return null;
  const on = value.start || value.end;
  const chosen = [value.start && "start", value.end && "end"].filter(
    (v): v is string => Boolean(v),
  );
  return (
    <div className="flex max-w-full flex-col gap-1.5 rounded-lg border bg-background/95 p-2 text-xs shadow-md backdrop-blur">
      <div className="flex items-center gap-2">
        <Checkbox
          id="map-show-hotel"
          checked={on}
          onCheckedChange={(checked) =>
            onChange(
              checked === true
                ? { start: hotels.start, end: hotels.end }
                : NO_HOTELS,
            )
          }
        />
        <Label
          htmlFor="map-show-hotel"
          className="flex items-center gap-1 text-xs font-medium"
        >
          <BedDouble className="size-3.5" aria-hidden />
          {t("day.showHotel")}
        </Label>
      </div>
      {on && hotels.two && start && end && (
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          value={chosen}
          aria-label={t("day.whichHotels")}
          onValueChange={(next) => {
            const shown = {
              start: next.includes("start"),
              end: next.includes("end"),
            };
            onChange(shown.start || shown.end ? shown : NO_HOTELS);
          }}
          className="flex-wrap justify-start"
        >
          <ToggleGroupItem value="start" className="max-w-40 text-xs">
            <span className="truncate">
              {t("day.hotelMorning", { name: start.name })}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem value="end" className="max-w-40 text-xs">
            <span className="truncate">
              {t("day.hotelNight", { name: end.name })}
            </span>
          </ToggleGroupItem>
        </ToggleGroup>
      )}
    </div>
  );
}
