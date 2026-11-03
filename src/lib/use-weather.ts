"use client";

import { useEffect, useMemo, useState } from "react";

import { addDays } from "@/domain/days";
import { sunTimes, type SunTimes } from "@/domain/sun";
import type { DayWeather } from "@/domain/weather";
import type { LatLng } from "@/lib/geo";
import { forecast, locateCity, typical } from "@/lib/open-meteo";
import { todayInTokyo } from "@/lib/tokyo-date";
import { useOnline } from "@/lib/use-online";

export type DayOutlook = { sun: SunTimes | null; weather: DayWeather | null };

// The forecast reaches 16 days ahead; later dates get what's typical.
const FORECAST_DAYS = 15;

// Sunrise, sunset and weather for each date, in the city given for it (the
// first city on a transfer day). Sun times are worked out here once the
// city is found; weather needs a connection and quietly stays empty without
// one. Past days show the sun only.
export function useDaysWeather(
  entries: { date: string; city: string | null }[],
): Map<string, DayOutlook> {
  const online = useOnline();
  const key = JSON.stringify(entries);
  const [found, setFound] = useState<{
    key: string;
    points: Record<string, LatLng | null>;
    weather: Record<string, DayWeather>;
  } | null>(null);

  useEffect(() => {
    const list: { date: string; city: string | null }[] = JSON.parse(key);
    const cities = [...new Set(list.flatMap((e) => (e.city ? [e.city] : [])))];
    if (cities.length === 0) return;
    let stopped = false;
    const today = todayInTokyo();
    const lastForecast = addDays(today, FORECAST_DAYS);

    (async () => {
      const points: Record<string, LatLng | null> = {};
      const weather: Record<string, DayWeather> = {};
      for (const city of cities) {
        const at = await locateCity(city).catch(() => null);
        points[city] = at;
        if (!at || !online) continue;
        const dates = list
          .filter((e) => e.city === city && e.date >= today)
          .map((e) => e.date);
        const soon = dates.filter((d) => d <= lastForecast);
        const later = dates.filter((d) => d > lastForecast);
        const [near, far] = await Promise.all([
          soon.length ? forecast(at).catch(() => ({})) : {},
          later.length ? typical(at, later).catch(() => ({})) : {},
        ]);
        for (const d of soon) {
          const w = (near as Record<string, DayWeather>)[d];
          if (w) weather[`${city}|${d}`] = w;
        }
        for (const d of later) {
          const w = (far as Record<string, DayWeather>)[d];
          if (w) weather[`${city}|${d}`] = w;
        }
      }
      if (!stopped) setFound({ key, points, weather });
    })();
    return () => {
      stopped = true;
    };
  }, [key, online]);

  return useMemo(() => {
    const result = new Map<string, DayOutlook>();
    if (!found || found.key !== key) return result;
    const list: { date: string; city: string | null }[] = JSON.parse(key);
    for (const { date, city } of list) {
      const at = city ? found.points[city] : null;
      result.set(date, {
        sun: at ? sunTimes(date, at.lat, at.lng) : null,
        weather: city ? (found.weather[`${city}|${date}`] ?? null) : null,
      });
    }
    return result;
  }, [found, key]);
}
