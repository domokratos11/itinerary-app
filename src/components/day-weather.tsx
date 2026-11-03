"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react";

import { Tip } from "@/components/tip";
import type { WeatherKind } from "@/domain/weather";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DayOutlook } from "@/lib/use-weather";

export const WEATHER_ICON: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

// Winter sunsets before five shape the plan, so they stand out.
const EARLY_SUNSET = "17:00";

// One line for a day: sunrise, sunset, and the weather when it's known.
export function DayWeatherStrip({
  outlook,
  className,
}: {
  outlook: DayOutlook | undefined;
  className?: string;
}) {
  if (!outlook?.sun && !outlook?.weather) return null;
  const { sun, weather } = outlook;
  const Icon = weather ? WEATHER_ICON[weather.kind] : null;
  return (
    <p
      aria-label={t("weather.outlook")}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground",
        className,
      )}
    >
      {weather && Icon && (
        <span className="flex items-center gap-1.5">
          <Icon aria-hidden className="size-4 text-foreground" />
          <span className="text-foreground">
            {t(`weather.${weather.kind}`)}
          </span>
          <span className="tabular-nums">
            {t("weather.temps", {
              max: Math.round(weather.maxC),
              min: Math.round(weather.minC),
            })}
          </span>
          {weather.precipPct !== null && weather.precipPct > 0 && (
            <span className="tabular-nums">
              · {t("weather.precip", { pct: weather.precipPct })}
            </span>
          )}
          {weather.source === "typical" ? (
            <Tip label={t("weather.tipTypical")}>
              <span className="rounded border border-dashed px-1 text-xs">
                {t("weather.typical")}
              </span>
            </Tip>
          ) : (
            <span className="rounded border px-1 text-xs">
              {t("weather.forecast")}
            </span>
          )}
        </span>
      )}
      {sun && (
        <>
          <span className="flex items-center gap-1 tabular-nums">
            <Sunrise aria-hidden className="size-4" />
            {t("weather.sunrise", { time: sun.sunrise })}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 tabular-nums",
              sun.sunset < EARLY_SUNSET &&
                "font-medium text-amber-700 dark:text-amber-400",
            )}
          >
            <Sunset aria-hidden className="size-4" />
            {t("weather.sunset", { time: sun.sunset })}
          </span>
        </>
      )}
    </p>
  );
}

// A small icon and the high, for a calendar cell.
export function WeatherBadge({ outlook }: { outlook: DayOutlook | undefined }) {
  const weather = outlook?.weather;
  if (!weather) return null;
  const Icon = WEATHER_ICON[weather.kind];
  return (
    <span
      className="flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums"
      title={t(`weather.${weather.kind}`)}
    >
      <Icon aria-hidden className="size-3" />
      <span className="hidden lg:inline">{`${Math.round(weather.maxC)}°`}</span>
    </span>
  );
}
