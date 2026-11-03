import {
  typicalWeather,
  weatherKind,
  yearsBefore,
  type DayWeather,
  type PastDay,
} from "@/domain/weather";
import type { LatLng } from "@/lib/geo";

// Open-Meteo is free, needs no key and answers the browser directly, so this
// works on the static site. Nothing it returns is stored in Firestore: only
// in memory and, to save requests, briefly in this browser's storage.

const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const TZ = "Asia/Tokyo";
const PAST_YEARS = 3;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Requests in flight or done in this visit, so many cells asking at once
// make one call.
const memory = new Map<string, Promise<unknown>>();

function cached<T>(key: string, ttl: number, load: () => Promise<T>) {
  const known = memory.get(key);
  if (known) return known as Promise<T>;
  const storageKey = `weather:${key}`;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (saved && Date.now() - saved.at < ttl) {
      const value = Promise.resolve(saved.value as T);
      memory.set(key, value);
      return value;
    }
  } catch {
    // No storage: just ask.
  }
  const value = load().then((result) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ at: Date.now(), value: result }),
      );
    } catch {
      // Only a saving.
    }
    return result;
  });
  // A failure isn't remembered, so the next look tries again.
  value.catch(() => memory.delete(key));
  memory.set(key, value);
  return value;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
  return response.json();
}

// What to look a city up by: its name, then its first word ("Tokyo (Ueno)"
// is looked up as "Tokyo").
export function placeQueries(name: string): string[] {
  const first = name.split(/[\s(,/·–-]+/)[0];
  return [...new Set([name.trim(), first].filter(Boolean))];
}

// A city's coordinates from Open-Meteo's own gazetteer, never from Google.
export function locateCity(name: string): Promise<LatLng | null> {
  return cached(`geo:${name}`, 30 * DAY, async () => {
    for (const query of placeQueries(name)) {
      const url = `${GEOCODE}?name=${encodeURIComponent(query)}&count=1&language=en&format=json&countryCode=JP`;
      const data = (await getJson(url)) as {
        results?: { latitude: number; longitude: number }[];
      };
      const hit = data.results?.[0];
      if (hit) return { lat: hit.latitude, lng: hit.longitude };
    }
    return null;
  });
}

const point = (at: LatLng) =>
  `latitude=${at.lat.toFixed(2)}&longitude=${at.lng.toFixed(2)}`;

type Daily = {
  time: string[];
  weather_code: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_probability_max?: (number | null)[];
  precipitation_sum?: (number | null)[];
};

// The next 16 days, by date.
export function forecast(at: LatLng): Promise<Record<string, DayWeather>> {
  return cached(`forecast:${point(at)}`, 3 * HOUR, async () => {
    const url = `${FORECAST}?${point(at)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(TZ)}&forecast_days=16`;
    const { daily } = (await getJson(url)) as { daily: Daily };
    const days: Record<string, DayWeather> = {};
    daily.time.forEach((date, i) => {
      const code = daily.weather_code[i];
      const maxC = daily.temperature_2m_max[i];
      const minC = daily.temperature_2m_min[i];
      if (code === null || maxC === null || minC === null) return;
      days[date] = {
        kind: weatherKind(code),
        maxC,
        minC,
        precipPct: daily.precipitation_probability_max?.[i] ?? null,
        source: "forecast",
      };
    });
    return days;
  });
}

// What `dates` are usually like, from the same dates in the last three
// years. One archive request per year, covering every date at once.
export function typical(
  at: LatLng,
  dates: string[],
): Promise<Record<string, DayWeather>> {
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return cached(`typical:${point(at)}:${first}:${last}`, 7 * DAY, async () => {
    const byDate = new Map<string, PastDay[]>();
    for (let years = 1; years <= PAST_YEARS; years += 1) {
      const url = `${ARCHIVE}?${point(at)}&start_date=${yearsBefore(first, years)}&end_date=${yearsBefore(last, years)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=${encodeURIComponent(TZ)}`;
      const { daily } = (await getJson(url)) as { daily: Daily };
      daily.time.forEach((past, i) => {
        const date = `${Number(past.slice(0, 4)) + years}${past.slice(4)}`;
        const code = daily.weather_code[i];
        const maxC = daily.temperature_2m_max[i];
        const minC = daily.temperature_2m_min[i];
        if (code === null || maxC === null || minC === null) return;
        const list = byDate.get(date) ?? [];
        list.push({
          code,
          maxC,
          minC,
          precipMm: daily.precipitation_sum?.[i] ?? 0,
        });
        byDate.set(date, list);
      });
    }
    const days: Record<string, DayWeather> = {};
    for (const date of sorted) {
      const weather = typicalWeather(byDate.get(date) ?? []);
      if (weather) days[date] = weather;
    }
    return days;
  });
}
