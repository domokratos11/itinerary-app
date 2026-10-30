import { z } from "zod";

import type { Category, PlaceRecord, Priority } from "./schemas";
import { uniqueId } from "./trip-edit";

// What the place form holds: every editable field as text, so a half-typed
// number or date never reaches the record.
export type PlaceForm = {
  name: string;
  mapsUrl: string;
  category: Category;
  priority: Priority;
  purpose: string;
  description: string;
  tips: string; // one per line
  cost: string; // yen, blank = not researched
  durationMin: string;
  openingHours: string;
  closedDates: string; // comma or space separated YYYY-MM-DD
  seasonFrom: string;
  seasonTo: string;
  websiteUrl: string;
  notes: string;
};

export type PlaceFields = Omit<PlaceRecord, "id" | "cityId" | "lat" | "lng">;

export function formFromPlace(place: PlaceRecord | null): PlaceForm {
  return {
    name: place?.name ?? "",
    mapsUrl: place?.mapsUrl ?? "",
    category: place?.category ?? "sight",
    priority: place?.priority ?? "want",
    purpose: place?.purpose ?? "",
    description: place?.description ?? "",
    tips: place?.tips.join("\n") ?? "",
    cost: place?.costEstimateJPY?.toString() ?? "",
    durationMin: place?.durationMin?.toString() ?? "",
    openingHours: place?.openingHours ?? "",
    closedDates: place?.closedDates.join(", ") ?? "",
    seasonFrom: place?.seasonFrom ?? "",
    seasonTo: place?.seasonTo ?? "",
    websiteUrl: place?.websiteUrl ?? "",
    notes: place?.notes ?? "",
  };
}

const isoDate = z.iso.date();
const url = z.url();
const blank = (s: string) => s.trim() === "";
const orNull = (s: string) => (blank(s) ? null : s.trim());

// Google Maps link for a place typed in by hand: a search on its name.
export function searchUrl(name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name.trim())}`;
}

export type PlaceFormResult =
  { ok: true; fields: PlaceFields } | { ok: false; error: string };

// Checks the form and turns it into record fields. A blank link falls back
// to a Maps search on the name. `base` carries what the form doesn't edit.
export function placeFromForm(
  form: PlaceForm,
  base: Pick<
    PlaceRecord,
    "status" | "source" | "verifiedAt" | "archived" | "updatedAt"
  >,
): PlaceFormResult {
  const name = form.name.trim();
  if (!name) return { ok: false, error: "Give the place a name." };

  const mapsUrl = blank(form.mapsUrl) ? searchUrl(name) : form.mapsUrl.trim();
  if (!url.safeParse(mapsUrl).success)
    return { ok: false, error: "The Maps link isn't a valid URL." };

  const websiteUrl = orNull(form.websiteUrl);
  if (websiteUrl && !url.safeParse(websiteUrl).success)
    return { ok: false, error: "The website isn't a valid URL." };

  const costEstimateJPY = blank(form.cost) ? null : Number(form.cost);
  if (
    costEstimateJPY !== null &&
    (!Number.isInteger(costEstimateJPY) || costEstimateJPY < 0)
  )
    return { ok: false, error: "Cost is a whole number of yen, or blank." };

  const durationMin = blank(form.durationMin) ? null : Number(form.durationMin);
  if (
    durationMin !== null &&
    (!Number.isInteger(durationMin) || durationMin < 1)
  )
    return { ok: false, error: "Time needed is whole minutes, or blank." };

  const closedDates = form.closedDates
    .split(/[\s,]+/)
    .filter(Boolean)
    .sort();
  const badDate = closedDates.find((d) => !isoDate.safeParse(d).success);
  if (badDate)
    return { ok: false, error: `"${badDate}" isn't a date like 2026-12-31.` };

  const seasonFrom = orNull(form.seasonFrom);
  const seasonTo = orNull(form.seasonTo);
  if (
    (seasonFrom && !isoDate.safeParse(seasonFrom).success) ||
    (seasonTo && !isoDate.safeParse(seasonTo).success)
  )
    return { ok: false, error: "Season dates look like 2026-12-31." };
  if (seasonFrom && seasonTo && seasonFrom > seasonTo)
    return { ok: false, error: "The season ends before it starts." };

  return {
    ok: true,
    fields: {
      name,
      mapsUrl,
      category: form.category,
      priority: form.priority,
      purpose: orNull(form.purpose),
      description: orNull(form.description),
      tips: form.tips
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean),
      costEstimateJPY,
      durationMin,
      openingHours: orNull(form.openingHours),
      closedDates,
      seasonFrom,
      seasonTo,
      websiteUrl,
      notes: orNull(form.notes),
      ...base,
    },
  };
}

// A place added by hand: no coordinates until it is researched.
export function newPlaceRecord(
  fields: PlaceFields,
  cityId: string,
  takenIds: Iterable<string>,
): PlaceRecord {
  return {
    ...fields,
    id: uniqueId(fields.name, takenIds),
    cityId,
    lat: null,
    lng: null,
  };
}
