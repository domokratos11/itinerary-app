// A day's weather from Open-Meteo (free, no key, not Google): a forecast for
// the next 16 days, and for later dates what the same dates were like over
// the last three years.

export type WeatherKind =
  "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export const WEATHER_KINDS: WeatherKind[] = [
  "clear",
  "partly",
  "cloudy",
  "fog",
  "drizzle",
  "rain",
  "snow",
  "storm",
];

export type DayWeather = {
  kind: WeatherKind;
  maxC: number;
  minC: number;
  // Chance of rain or snow, 0 to 100.
  precipPct: number | null;
  // A forecast, or what's typical for the date from past years.
  source: "forecast" | "typical";
};

// WMO weather interpretation codes, as Open-Meteo returns them.
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

export type PastDay = {
  code: number;
  maxC: number;
  minC: number;
  precipMm: number;
};

// What a date is usually like, from the same date in past years: average
// temperatures, the share of years with rain or snow (1 mm or more), and the
// most common kind of weather.
export function typicalWeather(years: PastDay[]): DayWeather | null {
  if (years.length === 0) return null;
  const average = (values: number[]) =>
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const kinds = years.map((y) => weatherKind(y.code));
  const counts = new Map<WeatherKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const kind = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  return {
    kind,
    maxC: average(years.map((y) => y.maxC)),
    minC: average(years.map((y) => y.minC)),
    precipPct: Math.round(
      (years.filter((y) => y.precipMm >= 1).length / years.length) * 100,
    ),
    source: "typical",
  };
}

// The same calendar date `years` years earlier.
export function yearsBefore(date: string, years: number): string {
  return `${Number(date.slice(0, 4)) - years}${date.slice(4)}`;
}
