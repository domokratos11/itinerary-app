import { z } from "zod";

import { ActivitySchema, type Activity } from "./activity";
import type { Translate } from "./i18n";
import { withoutGoogleCoordinates } from "./location";
import {
  CityRecordSchema,
  ExpenseRecordSchema,
  FlightRecordSchema,
  HolidayRecordSchema,
  PlaceRecordSchema,
  PlanItemSchema,
  BudgetSchema,
  ProposalSchema,
  ReservationRecordSchema,
  StayRecordSchema,
  type PlanItem,
  type Proposal,
} from "./schemas";
import type { TripData } from "./trip";

// The whole trip in one file: Export in Settings writes it, Import restores
// it into an empty trip. A backup can be kept for good, so it never holds
// coordinates from Google: they may be kept for 30 days at most. maps:refresh
// fetches them again by place ID. Older backups lack the parts added since.
// Restoring never changes who has access, so the trip's name and members, and
// the old Queue's links (which can no longer be written), stay in the file only.
const TripDetailsSchema = z.object({
  name: z.string().nullable(),
  members: z.array(z.string()),
  budget: BudgetSchema.nullable(),
});

export type BackupExtras = {
  trip: z.infer<typeof TripDetailsSchema> | null;
  activity: Activity[];
  queue: Record<string, unknown>[];
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
    items: z.array(PlanItemSchema),
    proposals: z.array(ProposalSchema).default([]),
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
