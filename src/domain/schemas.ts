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

export const CityRecordSchema = CitySchema.extend(recordFields);

export const StayRecordSchema = StaySchema.extend({
  id: recordId,
  note: z.string().max(500).nullable(),
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
  ...recordFields,
});

export type CityRecord = z.infer<typeof CityRecordSchema>;
export type StayRecord = z.infer<typeof StayRecordSchema>;
export type ReservationRecord = z.infer<typeof ReservationRecordSchema>;
export type PlaceRecord = z.infer<typeof PlaceRecordSchema>;

export type City = z.infer<typeof CitySchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Stay = z.infer<typeof StaySchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type TripFile = z.infer<typeof TripFileSchema>;
export type PlanItem = z.infer<typeof PlanItemSchema>;
export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
