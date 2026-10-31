import {
  PlaceRecordSchema,
  placeRecordDefaults,
  type Category,
  type Place,
  type PlaceRecord,
  type Priority,
} from "./schemas";
import { uniqueId } from "./trip-edit";

// What the place editor can change. "location" stands for lat and lng.
export const EDITABLE_FIELDS = [
  "name",
  "mapsUrl",
  "category",
  "priority",
  "purpose",
  "description",
  "tips",
  "costEstimateJPY",
  "durationMin",
  "openingHours",
  "closedDates",
  "seasonFrom",
  "seasonTo",
  "websiteUrl",
  "notes",
  "nearestStation",
  "verifiedAt",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export const LOCATION_FIELD = "location";

export type PlaceChanges = Pick<PlaceRecord, EditableField | "lat" | "lng">;

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// The fields a hand edit changed, as lockedFields names them.
export function changedFields(
  before: PlaceRecord,
  changes: PlaceChanges,
): string[] {
  const fields: string[] = EDITABLE_FIELDS.filter(
    (field) => !same(before[field], changes[field]),
  );
  if (before.lat !== changes.lat || before.lng !== changes.lng)
    fields.push(LOCATION_FIELD);
  return fields;
}

// The place after a hand edit. Whatever changed is locked so research leaves
// it alone, and coordinates typed by hand stop being Google's to refresh.
export function applyPlaceEdit(
  before: PlaceRecord,
  changes: PlaceChanges,
  now: Date,
): PlaceRecord {
  const changed = changedFields(before, changes);
  const moved = changed.includes(LOCATION_FIELD);
  return {
    ...before,
    ...changes,
    locationSource: moved
      ? changes.lat === null
        ? null
        : "manual"
      : before.locationSource,
    locationFetchedAt: moved ? null : before.locationFetchedAt,
    lockedFields: [...new Set([...before.lockedFields, ...changed])],
    updatedAt: now.toISOString(),
  };
}

// The form's text, one string per input.
export type PlaceForm = {
  name: string;
  mapsUrl: string;
  category: Category;
  priority: Priority;
  lat: string;
  lng: string;
  purpose: string;
  description: string;
  tips: string;
  cost: string;
  duration: string;
  openingHours: string;
  closedDates: string;
  seasonFrom: string;
  seasonTo: string;
  websiteUrl: string;
  notes: string;
  stationName: string;
  stationLines: string;
  stationWalk: string;
  verifiedAt: string;
};

export function placeToForm(place: PlaceRecord): PlaceForm {
  const station = place.nearestStation;
  return {
    name: place.name,
    mapsUrl: place.mapsUrl,
    category: place.category,
    priority: place.priority,
    lat: place.lat?.toString() ?? "",
    lng: place.lng?.toString() ?? "",
    purpose: place.purpose ?? "",
    description: place.description ?? "",
    tips: place.tips.join("\n"),
    cost: place.costEstimateJPY?.toString() ?? "",
    duration: place.durationMin?.toString() ?? "",
    openingHours: place.openingHours ?? "",
    closedDates: place.closedDates.join(", "),
    seasonFrom: place.seasonFrom ?? "",
    seasonTo: place.seasonTo ?? "",
    websiteUrl: place.websiteUrl ?? "",
    notes: place.notes ?? "",
    stationName: station?.name ?? "",
    stationLines: station?.lines.join(", ") ?? "",
    stationWalk: station?.walkMin?.toString() ?? "",
    verifiedAt: place.verifiedAt ?? "",
  };
}

const text = (value: string) => value.trim() || null;
const number = (value: string) =>
  value.trim() === "" ? null : Number(value.trim());
const list = (value: string, separator: RegExp) =>
  value
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);

export function formToChanges(form: PlaceForm): PlaceChanges {
  const stationName = text(form.stationName);
  return {
    name: form.name.trim(),
    mapsUrl: form.mapsUrl.trim(),
    category: form.category,
    priority: form.priority,
    lat: number(form.lat),
    lng: number(form.lng),
    purpose: text(form.purpose),
    description: text(form.description),
    tips: list(form.tips, /\n/),
    costEstimateJPY: number(form.cost),
    durationMin: number(form.duration),
    openingHours: text(form.openingHours),
    closedDates: list(form.closedDates, /[,\s]+/),
    seasonFrom: text(form.seasonFrom),
    seasonTo: text(form.seasonTo),
    websiteUrl: text(form.websiteUrl),
    notes: text(form.notes),
    nearestStation: stationName
      ? {
          name: stationName,
          lines: list(form.stationLines, /,/),
          walkMin: number(form.stationWalk),
        }
      : null,
    verifiedAt: text(form.verifiedAt),
  };
}

// The edited place if the form is valid, otherwise the first problem. Lat and
// lng only make sense together.
export function validatePlaceForm(
  before: PlaceRecord,
  form: PlaceForm,
  now: Date,
): { ok: true; place: PlaceRecord } | { ok: false; problem: string } {
  const changes = formToChanges(form);
  if ((changes.lat === null) !== (changes.lng === null))
    return { ok: false, problem: "lat: enter both latitude and longitude" };
  const result = PlaceRecordSchema.safeParse(
    applyPlaceEdit(before, changes, now),
  );
  if (result.success) return { ok: true, place: result.data };
  const issue = result.error.issues[0];
  return { ok: false, problem: `${issue.path.join(".")}: ${issue.message}` };
}

// The information a place should have. "Needs research" comes from what is
// actually empty, not from the stored status, which marks every catalog place
// researched even when it holds nothing.
export const RESEARCH_FIELDS = [
  "description",
  "costEstimateJPY",
  "durationMin",
  "openingHours",
  "websiteUrl",
  "nearestStation",
] as const;

export type ResearchField = (typeof RESEARCH_FIELDS)[number];

export const RESEARCH_FIELD_LABEL: Record<ResearchField, string> = {
  description: "description",
  costEstimateJPY: "cost",
  durationMin: "time needed",
  openingHours: "hours",
  websiteUrl: "website",
  nearestStation: "station",
};

export function missingFields(place: PlaceRecord): ResearchField[] {
  return RESEARCH_FIELDS.filter((field) => place[field] === null);
}

export function needsResearch(place: PlaceRecord): boolean {
  return missingFields(place).length > 0;
}

export function hasPin(place: Pick<Place, "lat" | "lng">): boolean {
  return place.lat !== null && place.lng !== null;
}

export const PLACE_FILTERS = [
  "all",
  "missing-cost",
  "missing-hours",
  "no-pin",
  "needs-research",
  "review",
] as const;

export type PlaceFilter = (typeof PLACE_FILTERS)[number];

export const PLACE_FILTER_LABEL: Record<PlaceFilter, string> = {
  all: "All places",
  "missing-cost": "Missing cost",
  "missing-hours": "Missing hours",
  "no-pin": "No map pin",
  "needs-research": "Needs research",
  review: "Has research to review",
};

export function matchesPlaceFilter(
  place: PlaceRecord,
  filter: PlaceFilter,
  reviewable: ReadonlySet<string>,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "missing-cost":
      return place.costEstimateJPY === null;
    case "missing-hours":
      return place.openingHours === null;
    case "no-pin":
      return !hasPin(place);
    case "needs-research":
      return needsResearch(place);
    case "review":
      return reviewable.has(place.id);
  }
}

export function mapsSearchUrl(name: string, googlePlaceId?: string): string {
  const query = encodeURIComponent(`${name} Japan`);
  const id = googlePlaceId ? `&query_place_id=${googlePlaceId}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${query}${id}`;
}

// A new place from the Add place form: a draft, until research fills it in.
export function newDraftPlace(
  input: {
    name: string;
    cityId: string;
    category: Category;
    priority: Priority;
    mapsUrl: string | null;
    lat: number | null;
    lng: number | null;
    googlePlaceId: string | null;
    // Coordinates just fetched from Google, rather than read from a link.
    fromGoogle: boolean;
    takenIds: Iterable<string>;
  },
  now: Date,
): PlaceRecord {
  const name = input.name.trim();
  const located = input.lat !== null && input.lng !== null;
  return {
    id: uniqueId(name, input.takenIds),
    cityId: input.cityId,
    mapsUrl:
      input.mapsUrl ?? mapsSearchUrl(name, input.googlePlaceId ?? undefined),
    name,
    lat: input.lat,
    lng: input.lng,
    category: input.category,
    purpose: null,
    description: null,
    tips: [],
    costEstimateJPY: null,
    durationMin: null,
    openingHours: null,
    closedDates: [],
    seasonFrom: null,
    seasonTo: null,
    priority: input.priority,
    verifiedAt: null,
    websiteUrl: null,
    notes: null,
    status: "draft",
    source: "catalog",
    ...placeRecordDefaults(),
    googlePlaceId: input.googlePlaceId,
    locationSource: located ? (input.fromGoogle ? "google" : "manual") : null,
    locationFetchedAt: located && input.fromGoogle ? now.toISOString() : null,
    archived: false,
    updatedAt: now.toISOString(),
  };
}
