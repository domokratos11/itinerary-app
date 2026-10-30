// Internal links. Every page keeps ?trip= so a shared link keeps working
// after navigation. Paths end in "/" (trailingSlash in next.config).
export function pageHref(
  path: string,
  tripId: string | null,
  params: Record<string, string> = {},
): string {
  const query = new URLSearchParams(params);
  if (tripId) query.set("trip", tripId);
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

export const homeHref = (tripId: string | null) => pageHref("/", tripId);

export const dayHref = (date: string, tripId: string | null) =>
  pageHref("/day/", tripId, { date });

export const cityHref = (cityId: string, tripId: string | null) =>
  pageHref("/city/", tripId, { id: cityId });
