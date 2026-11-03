// Sunrise and sunset worked out on the device from a date and a place, with
// NOAA's solar equations (accurate to about a minute at these latitudes). No
// network and no Google data: the coordinates are the city's own.

export type SunTimes = {
  sunrise: string; // HH:MM in Tokyo
  sunset: string; // HH:MM in Tokyo
  daylightMin: number;
};

const RAD = Math.PI / 180;
// Japan has one time zone and no daylight saving.
const TOKYO_OFFSET_MIN = 9 * 60;

function dayOfYear(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000 + 1;
}

function isLeap(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function clock(minutes: number): string {
  const m = Math.round(((minutes % 1440) + 1440) % 1440);
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Null where the sun doesn't rise or set that day (never in Japan).
export function sunTimes(
  date: string,
  lat: number,
  lng: number,
): SunTimes | null {
  const year = Number(date.slice(0, 4));
  // Fractional year, in radians, at local noon.
  const g =
    ((2 * Math.PI) / (isLeap(year) ? 366 : 365)) * (dayOfYear(date) - 1);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  // 90.833°: the sun's disc and the bending of light at the horizon.
  const cosHa =
    Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) -
    Math.tan(lat * RAD) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null;
  const ha = Math.acos(cosHa) / RAD;
  const noonUtc = 720 - 4 * lng - eqTime;
  const rise = noonUtc - 4 * ha + TOKYO_OFFSET_MIN;
  const set = noonUtc + 4 * ha + TOKYO_OFFSET_MIN;
  return {
    sunrise: clock(rise),
    sunset: clock(set),
    daylightMin: Math.round(set - rise),
  };
}
