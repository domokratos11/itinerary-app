// How old the device's copy of the trip is, worked out from the last moment
// it was known to match the server. Offline, the app still opens on that copy;
// past STALE_AFTER_DAYS it says the plan may be out of date.
export const STALE_AFTER_DAYS = 3;

export type SyncAge = {
  // "never": no sync recorded on this device yet.
  freshness: "never" | "fresh" | "stale";
  // The age, for wording as "x ago": the largest whole unit that fits.
  value: number;
  unit: "minute" | "hour" | "day";
};

export function syncAge(last: Date | null, now: Date): SyncAge {
  if (!last) return { freshness: "never", value: 0, unit: "minute" };
  const minutes = Math.max(0, Math.floor((+now - +last) / 60_000));
  const days = Math.floor(minutes / 1440);
  const freshness = days >= STALE_AFTER_DAYS ? "stale" : "fresh";
  if (days >= 1) return { freshness, value: days, unit: "day" };
  if (minutes >= 60)
    return { freshness, value: Math.floor(minutes / 60), unit: "hour" };
  return { freshness, value: minutes, unit: "minute" };
}
