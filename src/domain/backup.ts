import { z } from "zod";

import type { Translate } from "./i18n";
import { withoutGoogleCoordinates } from "./location";
import { QueuedPlaceSchema, type QueuedPlace } from "./queue";
import {
  CityRecordSchema,
  HolidayRecordSchema,
  PlaceRecordSchema,
  PlanItemSchema,
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
// fetches them again by place ID. Backups made before holidays moved into the
// trip have none.
export const BackupSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    cities: z.array(CityRecordSchema),
    stays: z.array(StayRecordSchema),
    reservations: z.array(ReservationRecordSchema),
    places: z.array(PlaceRecordSchema),
    holidays: z.array(HolidayRecordSchema).default([]),
    items: z.array(PlanItemSchema),
    queue: z.array(QueuedPlaceSchema),
    proposals: z.array(ProposalSchema).default([]),
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
  queue: QueuedPlace[],
  now: Date,
  proposals: Proposal[] = [],
): Backup {
  return {
    version: 1,
    exportedAt: now.toISOString(),
    ...trip,
    stays: trip.stays.map(withoutGoogleCoordinates),
    places: trip.places.map(withoutGoogleCoordinates),
    items,
    queue,
    proposals,
  };
}

export function backupSummary(backup: Backup, tr: Translate): string {
  return tr("backup.summary", {
    cities: backup.cities.length,
    stays: backup.stays.length,
    reservations: backup.reservations.length,
    places: backup.places.length,
    stops: backup.items.filter((i) => i.status !== "removed").length,
    queued: backup.queue.length,
  });
}
