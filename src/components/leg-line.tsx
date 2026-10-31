"use client";

import { Footprints, Navigation, TrainFront } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatDistance,
  formatLegNote,
  formatStation,
  formatWalk,
  type DayLeg,
} from "@/domain/legs";
import type { WalkingLeg } from "@/domain/maps-service";
import { t } from "@/lib/i18n";

// The line between two stops: how far, how long on foot if it's walkable, and
// for anything further a button that opens transit directions in the Maps app.
export function LegLine({
  leg,
  walking,
}: {
  leg: DayLeg;
  walking: WalkingLeg | undefined;
}) {
  const far = leg.kind === "far";
  const summary = walking
    ? formatWalk(walking.minutes, walking.meters, t)
    : leg.km !== null
      ? formatDistance(leg.km, t)
      : null;
  const Icon = far ? TrainFront : Footprints;

  return (
    <div className="flex flex-col gap-1 px-1 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {summary && (
          <span className="flex items-center gap-1.5">
            <Icon className="size-4 shrink-0" aria-hidden />
            {summary}
          </span>
        )}
        {leg.directions &&
          (far ? (
            <Button asChild variant="outline" size="xs">
              <a
                href={leg.directions}
                target="_blank"
                rel="noopener noreferrer"
              >
                <TrainFront />
                {t("leg.trainDirections")}
              </a>
            </Button>
          ) : (
            <a
              className="flex items-center gap-1 underline"
              href={leg.directions}
              target="_blank"
              rel="noopener noreferrer"
            >
              {!summary && <Navigation className="size-4" aria-hidden />}
              {t("common.directions")}
            </a>
          ))}
      </div>
      {leg.note && (
        <p>{t("leg.estimate", { note: formatLegNote(leg.note, t) })}</p>
      )}
      {far && leg.station && (
        <p>{t("leg.station", { station: formatStation(leg.station, t) })}</p>
      )}
    </div>
  );
}
