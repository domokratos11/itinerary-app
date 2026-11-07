"use client";

import { type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { hoursLeftInTokyoDay, type TripClock } from "@/domain/dashboard";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";

// The Dashboard's building blocks: tiles, panels, hints and the clock tiles.

export function Tile({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {children}
      </CardContent>
    </Card>
  );
}

export function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

// The first tiles: how far away the trip is, or how far along.
export function ClockTiles({
  clock,
  stopsLeft,
  plannedDays,
}: {
  clock: TripClock;
  stopsLeft: number;
  plannedDays: number;
}) {
  if (clock.phase === "before")
    return (
      <>
        <Tile
          label={t("dashboard.untilTrip")}
          value={t("dashboard.dayCount", { count: clock.daysUntil })}
        >
          <Hint>
            {t("dashboard.startsOn", { day: formatDayLabel(clock.first) })}
          </Hint>
        </Tile>
        <Tile
          label={t("dashboard.tripLength")}
          value={t("dashboard.dayCount", { count: clock.totalDays })}
        >
          <Progress
            value={(plannedDays / clock.totalDays) * 100}
            className="mt-1 h-2"
            aria-label={t("dashboard.daysWithPlan", {
              count: plannedDays,
              total: clock.totalDays,
            })}
          />
          <Hint>
            {t("dashboard.daysWithPlan", {
              count: plannedDays,
              total: clock.totalDays,
            })}
          </Hint>
        </Tile>
      </>
    );
  if (clock.phase === "during")
    return (
      <>
        <Tile
          label={t("dashboard.tripDay")}
          value={t("dashboard.dayOf", {
            day: clock.dayNumber,
            total: clock.totalDays,
          })}
        >
          <Progress
            value={(clock.dayNumber / clock.totalDays) * 100}
            className="mt-1 h-2"
            aria-label={t("dashboard.dayOf", {
              day: clock.dayNumber,
              total: clock.totalDays,
            })}
          />
          <Hint>{t("dashboard.daysLeft", { count: clock.daysLeft })}</Hint>
        </Tile>
        <Tile
          label={t("dashboard.todayLeft")}
          value={t("dashboard.stopCount", { count: stopsLeft })}
        >
          <Hint>
            {t("dashboard.hoursLeft", {
              count: hoursLeftInTokyoDay(new Date()),
            })}
          </Hint>
        </Tile>
      </>
    );
  if (clock.phase === "after")
    return (
      <Tile
        label={t("dashboard.tripOver")}
        value={t("dashboard.dayCount", { count: clock.totalDays })}
      />
    );
  return null;
}
