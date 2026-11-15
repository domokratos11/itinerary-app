import { z } from "zod";

import { ActivitySchema, type Activity } from "./activity";
import type { Translate } from "./i18n";
import { withoutGoogleCoordinates } from "./location";
import {
  CashRecordSchema,
  TodoListRecordSchema,
  TodoRecordSchema,
  CityRecordSchema,
  ExpenseRecordSchema,
  FlightRecordSchema,
  HolidayRecordSchema,
  PlaceRecordSchema,
  PlanItemSchema,
  BudgetSchema,
  DayResearchSchema,
  ProposalSchema,
  ReservationRecordSchema,
  StayRecordSchema,
  tripDatesOf,
  type TripDates,
  type PlanItem,
  type DayResearch,
  type Proposal,
} from "./schemas";
import type { TripData } from "./trip";

// The whole trip in one file: Export in Settings writes it, Import restores
// it into an empty trip. A backup can be kept for good, so it never holds
// coordinates from Google: they may be kept for 30 days at most. maps:refresh
// fetches them again by place ID. Older backups lack the parts added since.
// Restoring never changes who has access, so the trip's name and members, and
// the old Queue's links (which can no longer be written), stay in the file only.
// The trip's own dates are restored with the budget; files made before trips
// had dates have none.
const TripDetailsSchema = z.object({
  name: z.string().nullable(),
  members: z.array(z.string()),
  budget: BudgetSchema.nullable(),
  startDate: z.iso.date().nullable().default(null),
  endDate: z.iso.date().nullable().default(null),
});

// The dates a backup holds, if it holds a valid pair.
export function backupDates(backup: Backup): TripDates | null {
  return backup.trip ? tripDatesOf(backup.trip) : null;
}

type TripDetails = z.infer<typeof TripDetailsSchema>;

export type BackupExtras = {
  // The dates may be left out: a trip without them has none.
  trip:
    | (Omit<TripDetails, "startDate" | "endDate"> &
        Partial<Pick<TripDetails, "startDate" | "endDate">>)
    | null;
  activity: Activity[];
  queue: Record<string, unknown>[];
  dayResearch?: DayResearch[];
};

export const BackupSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    cities: z.array(CityRecordSchema),
    stays: z.array(StayRecordSchema),
    reservations: z.array(ReservationRecordSchema),
    places: z.array(PlaceRecordSchema),
    holidays: z.array(HolidayRecordSchema).default([]),
    expenses: z.array(ExpenseRecordSchema).default([]),
    flights: z.array(FlightRecordSchema).default([]),
    cash: z.array(CashRecordSchema).default([]),
    todoLists: z.array(TodoListRecordSchema).default([]),
    todos: z.array(TodoRecordSchema).default([]),
    items: z.array(PlanItemSchema),
    proposals: z.array(ProposalSchema).default([]),
    dayResearch: z.array(DayResearchSchema).default([]),
    trip: TripDetailsSchema.nullable().default(null),
    activity: z.array(ActivitySchema).default([]),
    queue: z.array(z.looseObject({})).default([]),
  })
  .refine(
    (b) =>
      ![...b.stays, ...b.places].some(
        (r) => r.locationSource === "google" && r.lat !== null,
      ),
    { message: "A backup must not contain coordinates from Google" },
  );

export type Backup = z.infer<typeof BackupSchema>;

// Everything, archived and removed records included, so nothing is lost.
export function makeBackup(
  trip: TripData,
  items: PlanItem[],
  now: Date,
  proposals: Proposal[] = [],
  extras: BackupExtras = { trip: null, activity: [], queue: [] },
): Backup {
  return {
    version: 1,
    exportedAt: now.toISOString(),
    ...trip,
    stays: trip.stays.map(withoutGoogleCoordinates),
    places: trip.places.map(withoutGoogleCoordinates),
    items,
    proposals,
    ...extras,
    trip: extras.trip && {
      ...extras.trip,
      startDate: extras.trip.startDate ?? null,
      endDate: extras.trip.endDate ?? null,
    },
    dayResearch: extras.dayResearch ?? [],
  };
}

export function backupSummary(backup: Backup, tr: Translate): string {
  return tr("backup.summary", {
    cities: backup.cities.length,
    stays: backup.stays.length,
    reservations: backup.reservations.length,
    places: backup.places.length,
    stops: backup.items.filter((i) => i.status !== "removed").length,
    expenses: backup.expenses.length,
    history: backup.activity.length,
  });
}
