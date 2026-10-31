import { z } from "zod";

// Shared trip model. Catalog files in data/ are checked against these
// schemas by `npm run validate`; the app imports the inferred types.

export const CATEGORIES = [
  "lights",
  "food",
  "shopping",
  "sight",
  "daytrip",
  "temple",
] as const;

export const PRIORITIES = ["must", "want", "maybe"] as const;

export const RESERVATION_TYPES = [
  "flight",
  "train",
  "hotel",
  "tour",
  "ticket",
] as const;

export const PLAN_STATUSES = ["planned", "done", "skipped", "removed"] as const;

// ISO calendar date, e.g. 2026-12-17.
const isoDate = z.iso.date();

export const CitySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const CitiesFileSchema = z.array(CitySchema);

// Fields a place can be missing until the research step fills them.
// null means "not researched yet", not "free" or "none".
export const PlaceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  cityId: z.string().regex(/^[a-z0-9-]+$/),
  mapsUrl: z.url(),
  name: z.string().min(1),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  category: z.enum(CATEGORIES),
  purpose: z.string().nullable(),
  description: z.string().nullable(),
  tips: z.array(z.string()),
  costEstimateJPY: z.number().int().nonnegative().nullable(),
  durationMin: z.number().int().positive().nullable(),
  openingHours: z.string().nullable(),
  closedDates: z.array(isoDate),
  seasonFrom: isoDate.nullable(),
  seasonTo: isoDate.nullable(),
  priority: z.enum(PRIORITIES),
  verifiedAt: isoDate.nullable(),
  websiteUrl: z.url().nullable(),
  notes: z.string().nullable(),
});

export const PlacesFileSchema = z.array(PlaceSchema);

export const StaySchema = z.object({
  cityId: z.string(),
  hotelName: z.string().min(1),
  hotelMapsUrl: z.url().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  checkIn: isoDate,
  checkOut: isoDate,
});

export const ReservationSchema = z.object({
  type: z.enum(RESERVATION_TYPES),
  date: isoDate,
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  note: z.string().nullable(),
});

export const TripFileSchema = z.object({
  stays: z.array(StaySchema),
  reservations: z.array(ReservationSchema),
});

// Holidays and closure periods in the trip window (data/holidays.json).
export const HolidaySchema = z.object({
  date: isoDate,
  name: z.string().min(1),
  kind: z.enum(["holiday", "closures"]),
  note: z.string().nullable(),
});

export const HolidaysFileSchema = z.array(HolidaySchema);

export const LEG_MODES = ["train", "subway", "bus", "walk", "taxi"] as const;

// A hand-typed or researched note on how to reach a stop. Ours, so it can be
// stored, unlike Google's route times. Treat these as estimates.
export const LegNoteSchema = z.object({
  mode: z.enum(LEG_MODES),
  minutes: z.number().int().positive().max(1440).nullable(),
  fareJPY: z.number().int().nonnegative().nullable(),
  text: z.string().max(200).nullable(),
});

export const PlanItemSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  date: isoDate,
  order: z.string(),
  startTime: z.string().nullable(),
  durationMin: z.number().int().positive().nullable(),
  note: z.string().nullable(),
  status: z.enum(PLAN_STATUSES),
  updatedAt: z.iso.datetime(),
  legNote: LegNoteSchema.nullable().default(null),
});

// Firestore records under trips/{tripId}. Each is the seed shape plus an
// id where the seed has none, `archived` (records are never deleted) and
// the time of the last change.
const recordId = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(64);
const recordFields = { archived: z.boolean(), updatedAt: z.iso.datetime() };

export const PLACE_STATUSES = ["draft", "researched"] as const;
export const PLACE_SOURCES = ["catalog", "queue"] as const;

export const LOCATION_SOURCES = ["google", "manual"] as const;

// How a place or stay relates to Google. A place ID may be stored for good;
// coordinates with source "google" for at most 30 days (see domain/location).
// Fields added after launch default to null, so older documents stay valid.
const mapFields = {
  googlePlaceId: z.string().min(1).max(300).nullable().default(null),
  locationFetchedAt: z.iso.datetime().nullable().default(null),
  locationSource: z.enum(LOCATION_SOURCES).nullable().default(null),
};

export const NO_MAP_FIELDS = {
  googlePlaceId: null,
  locationFetchedAt: null,
  locationSource: null,
} as const;

const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

export const NearestStationSchema = z.object({
  name: z.string().min(1).max(100),
  lines: z.array(z.string().min(1).max(60)).max(8),
  walkMin: z.number().int().nonnegative().max(120).nullable(),
});

// Where one researched fact came from.
export const FieldSourceSchema = z.object({
  field: z.string().min(1).max(40),
  url: httpsUrl,
});

export const CityRecordSchema = CitySchema.extend(recordFields);

export const StayRecordSchema = StaySchema.extend({
  id: recordId,
  note: z.string().max(500).nullable(),
  ...mapFields,
  ...recordFields,
});

export const ReservationRecordSchema = ReservationSchema.extend({
  id: recordId,
  ...recordFields,
});

// A draft place was made from a queued link and is waiting for research.
export const PlaceRecordSchema = PlaceSchema.extend({
  status: z.enum(PLACE_STATUSES),
  source: z.enum(PLACE_SOURCES),
  ...mapFields,
  nearestStation: NearestStationSchema.nullable().default(null),
  sources: z.array(FieldSourceSchema).max(60).default([]),
  // Fields edited by hand; research never changes them.
  lockedFields: z.array(z.string().min(1).max(40)).max(40).default([]),
  ...recordFields,
});

export const PROPOSAL_STATUSES = [
  "requested",
  "ready",
  "applied",
  "dismissed",
] as const;

// Research never writes to a place. It writes one of these, and a person
// accepts it field by field. Requested in the app, filled by a worker.
export const ProposalFieldsSchema = z
  .object({
    purpose: z.string().max(1000).nullable(),
    description: z.string().max(3000).nullable(),
    tips: z.array(z.string().max(300)).max(30),
    costEstimateJPY: z.number().int().nonnegative().nullable(),
    durationMin: z.number().int().positive().nullable(),
    openingHours: z.string().max(500).nullable(),
    closedDates: z.array(isoDate).max(60),
    seasonFrom: isoDate.nullable(),
    seasonTo: isoDate.nullable(),
    websiteUrl: httpsUrl.nullable(),
    notes: z.string().max(2000).nullable(),
    nearestStation: NearestStationSchema.nullable(),
    verifiedAt: isoDate.nullable(),
  })
  .partial();

export const ProposalSchema = z.object({
  id: recordId,
  placeId: recordId,
  status: z.enum(PROPOSAL_STATUSES),
  fields: ProposalFieldsSchema,
  sources: z.array(FieldSourceSchema).max(60),
  notes: z.string().max(2000).nullable(),
  requestedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// The fields a place record has beyond the seed shape.
export function placeRecordDefaults(): Pick<
  PlaceRecord,
  | "googlePlaceId"
  | "locationFetchedAt"
  | "locationSource"
  | "nearestStation"
  | "sources"
  | "lockedFields"
> {
  return {
    ...NO_MAP_FIELDS,
    nearestStation: null,
    sources: [],
    lockedFields: [],
  };
}

export type CityRecord = z.infer<typeof CityRecordSchema>;
export type StayRecord = z.infer<typeof StayRecordSchema>;
export type ReservationRecord = z.infer<typeof ReservationRecordSchema>;
export type PlaceRecord = z.infer<typeof PlaceRecordSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type ProposalFields = z.infer<typeof ProposalFieldsSchema>;
export type FieldSource = z.infer<typeof FieldSourceSchema>;
export type NearestStation = z.infer<typeof NearestStationSchema>;
export type LegNote = z.infer<typeof LegNoteSchema>;
export type LegMode = (typeof LEG_MODES)[number];

export type City = z.infer<typeof CitySchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Stay = z.infer<typeof StaySchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type Holiday = z.infer<typeof HolidaySchema>;
export type TripFile = z.infer<typeof TripFileSchema>;
export type PlanItem = z.infer<typeof PlanItemSchema>;
export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
