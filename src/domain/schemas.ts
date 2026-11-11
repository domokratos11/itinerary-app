import { z } from "zod";

// Shared trip model: what is stored in Firestore under trips/{tripId}. The
// app imports the inferred types.

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

export const EXPENSE_CATEGORIES = [
  "flight",
  "booking",
  "transport",
  "food",
  "souvenirs",
  "attractions",
  "clothes",
  "temples",
  "other",
] as const;

export const EXPENSE_STATUSES = ["planned", "paid"] as const;

// How an expense was paid. Records saved before this existed read as card.
export const PAYMENT_METHODS = ["card", "cash"] as const;

// Cash that moves without being spent: taken from an ATM, or handed from
// one member to another. Never counted in the budget.
export const CASH_KINDS = ["withdrawal", "handover"] as const;

// ISO calendar date, e.g. 2026-12-17.
const isoDate = z.iso.date();

export const CitySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

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

export const HOLIDAY_KINDS = ["holiday", "closures"] as const;

// A holiday or closure period in this trip's window.
export const HolidaySchema = z.object({
  date: isoDate,
  name: z.string().min(1),
  kind: z.enum(HOLIDAY_KINDS),
  note: z.string().nullable(),
});

export const PlanItemSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  date: isoDate,
  order: z.string(),
  status: z.enum(PLAN_STATUSES),
  updatedAt: z.iso.datetime(),
});

// Firestore records under trips/{tripId}. Each is the shape above plus an
// id where it has none, `archived` (records are never deleted) and the time
// of the last change.
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

export const HolidayRecordSchema = HolidaySchema.extend({
  id: recordId,
  ...recordFields,
});

export const FLIGHT_CURRENCIES = ["USD", "JPY"] as const;

const airportCode = z.string().regex(/^[A-Z]{3}$/);
const clockTime = z.string().regex(/^\d{2}:\d{2}$/);

// One flight, with dates and times local to each airport, as on the ticket.
export const FlightRecordSchema = z.object({
  id: recordId,
  airline: z.string().min(1).max(100),
  flightNumber: z.string().min(1).max(20),
  departDate: isoDate,
  departTime: clockTime,
  departAirport: airportCode,
  departCity: z.string().max(100).nullable(),
  arriveDate: isoDate,
  arriveTime: clockTime,
  arriveAirport: airportCode,
  arriveCity: z.string().max(100).nullable(),
  confirmation: z.string().max(40).nullable(),
  costAmount: z.number().nonnegative().nullable(),
  costCurrency: z.enum(FLIGHT_CURRENCIES),
  note: z.string().max(500).nullable(),
  ...recordFields,
});

// A draft place is waiting for research.
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

// Money for the whole trip, in whole yen. Planned means agreed but not paid
// yet. It may point at the place, booking or hotel it paid for, so that place
// isn't estimated on top of it.
export const ExpenseRecordSchema = z.object({
  id: recordId,
  title: z.string().min(1).max(200),
  amountJPY: z.number().int().nonnegative(),
  category: z.enum(EXPENSE_CATEGORIES),
  date: isoDate,
  status: z.enum(EXPENSE_STATUSES),
  paidBy: z.string().max(254).nullable(),
  placeId: recordId.nullable().default(null),
  reservationId: recordId.nullable().default(null),
  stayId: recordId.nullable().default(null),
  // The city it was spent in: where that night was, for a quick entry.
  cityId: recordId.nullable().default(null),
  // Entered in dollars: the amount and the rate used. amountJPY is still what
  // every total counts; these only say where it came from.
  originalUSD: z.number().nonnegative().nullable().default(null),
  rateJPYPerUSD: z.number().positive().nullable().default(null),
  paymentMethod: z.enum(PAYMENT_METHODS).default("card"),
  note: z.string().max(500).nullable(),
  ...recordFields,
});

// Cash taken out or handed over: who (`by`), to whom for a handover, the yen,
// and for a withdrawal the dollars the bank charged, typed by hand later and
// never worked out from a rate. It never reaches the budget's totals.
export const CashRecordSchema = z.object({
  id: recordId,
  kind: z.enum(CASH_KINDS),
  date: isoDate,
  amountJPY: z.number().int().nonnegative(),
  amountUSD: z.number().nonnegative().nullable(),
  by: z.string().min(1).max(254),
  to: z.string().min(1).max(254).nullable(),
  note: z.string().max(500).nullable(),
  ...recordFields,
});

// To-do lists for getting ready and keeping track: each list has its own
// to-dos. Archiving a list archives its to-dos with it.
export const TODO_STATUSES = ["todo", "inProgress", "done"] as const;
export const TODO_PRIORITIES = ["low", "normal", "high"] as const;

export const TodoListRecordSchema = z.object({
  id: recordId,
  title: z.string().min(1).max(120),
  description: z.string().max(1000).nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  order: z.number().int(),
  ...recordFields,
});

// A due date is a trip-style date (Japan time); the assignee is a member's
// email. `completedAt` is when it was last marked done.
export const TodoRecordSchema = z.object({
  id: recordId,
  listId: recordId,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  dueDate: isoDate.nullable(),
  status: z.enum(TODO_STATUSES),
  priority: z.enum(TODO_PRIORITIES),
  assignee: z.string().min(1).max(254).nullable(),
  order: z.number().int(),
  completedAt: z.iso.datetime().nullable(),
  ...recordFields,
});

// What the trip means to spend, kept on the trip document. Travellers
// multiplies per-adult place estimates; null uses the member count.
export const BudgetSchema = z.object({
  totalJPY: z.number().int().nonnegative().nullable(),
  byCategory: z.partialRecord(
    z.enum(EXPENSE_CATEGORIES),
    z.number().int().nonnegative(),
  ),
  travellers: z.number().int().positive().max(20).nullable(),
  // A spending target per member, by email: what that person may pay.
  byMember: z
    .record(z.string().max(254), z.number().int().nonnegative())
    .default({}),
});

// A whole trip's structure in one object; the sample trip the tests use.
export const TripDataSchema = z.object({
  cities: z.array(CityRecordSchema),
  stays: z.array(StayRecordSchema),
  reservations: z.array(ReservationRecordSchema),
  places: z.array(PlaceRecordSchema),
  holidays: z.array(HolidayRecordSchema),
  expenses: z.array(ExpenseRecordSchema).default([]),
  flights: z.array(FlightRecordSchema).default([]),
  cash: z.array(CashRecordSchema).default([]),
  todoLists: z.array(TodoListRecordSchema).default([]),
  todos: z.array(TodoRecordSchema).default([]),
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

export const DAY_RESEARCH_STATUSES = [
  "requested",
  "ready",
  "archived",
] as const;
export const DAY_LOADS = ["light", "medium", "heavy"] as const;
export const DAY_WARNING_KINDS = [
  "closed",
  "conflict",
  "timing",
  "other",
] as const;

// A researcher's view of a whole day, in their own words. It never holds
// Google data: no coordinates, hours or ratings copied from Maps.
export const DayAnalysisSchema = z.object({
  load: z.enum(DAY_LOADS),
  loadReason: z.string().min(1).max(500),
  summary: z.string().min(1).max(3000),
  warnings: z
    .array(
      z.object({
        kind: z.enum(DAY_WARNING_KINDS),
        placeIds: z.array(recordId).max(10),
        text: z.string().min(1).max(500),
      }),
    )
    .max(20),
  // Places near the day's stops that could be added, or not.
  hints: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        text: z.string().min(1).max(500),
        placeId: recordId.nullable(),
        mapsUrl: httpsUrl.nullable(),
      }),
    )
    .max(10),
  // The reply to the request's message, if it had one.
  answer: z.string().max(3000).nullable(),
  sources: z
    .array(z.object({ url: httpsUrl, note: z.string().max(200).nullable() }))
    .max(30),
  researchedAt: z.iso.datetime(),
});

// One per day, under trips/{tripId}/dayResearch/{date}. Asking again keeps the
// last analysis until the new one replaces it.
export const DayResearchSchema = z.object({
  id: recordId,
  date: isoDate,
  status: z.enum(DAY_RESEARCH_STATUSES),
  request: z.string().max(1000).nullable(),
  analysis: DayAnalysisSchema.nullable(),
  requestedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// The fields a place record has beyond the basic place.
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
export type HolidayRecord = z.infer<typeof HolidayRecordSchema>;
export type FlightRecord = z.infer<typeof FlightRecordSchema>;
export type FlightCurrency = (typeof FLIGHT_CURRENCIES)[number];
export type PlaceRecord = z.infer<typeof PlaceRecordSchema>;
export type ExpenseRecord = z.infer<typeof ExpenseRecordSchema>;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type CashRecord = z.infer<typeof CashRecordSchema>;
export type CashKind = (typeof CASH_KINDS)[number];
export type TodoListRecord = z.infer<typeof TodoListRecordSchema>;
export type TodoRecord = z.infer<typeof TodoRecordSchema>;
export type TodoStatus = (typeof TODO_STATUSES)[number];
export type TodoPriority = (typeof TODO_PRIORITIES)[number];
export type Budget = z.infer<typeof BudgetSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type DayResearch = z.infer<typeof DayResearchSchema>;
export type DayAnalysis = z.infer<typeof DayAnalysisSchema>;
export type DayLoad = (typeof DAY_LOADS)[number];
export type ProposalFields = z.infer<typeof ProposalFieldsSchema>;
export type FieldSource = z.infer<typeof FieldSourceSchema>;
export type NearestStation = z.infer<typeof NearestStationSchema>;

export type City = z.infer<typeof CitySchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Stay = z.infer<typeof StaySchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type Holiday = z.infer<typeof HolidaySchema>;
export type PlanItem = z.infer<typeof PlanItemSchema>;
export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
