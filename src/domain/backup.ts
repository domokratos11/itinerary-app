import { z } from "zod";

import { QueuedPlaceSchema, type QueuedPlace } from "./queue";
import {
  CityRecordSchema,
  PlaceRecordSchema,
  PlanItemSchema,
  ReservationRecordSchema,
  StayRecordSchema,
  type PlanItem,
} from "./schemas";
import type { TripData } from "./trip";

// The whole trip in one file: Export in Settings writes it, Import restores
// it into an empty trip. A copy can be kept in data/backups/ (validated).
export const BackupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  cities: z.array(CityRecordSchema),
  stays: z.array(StayRecordSchema),
  reservations: z.array(ReservationRecordSchema),
  places: z.array(PlaceRecordSchema),
  items: z.array(PlanItemSchema),
  queue: z.array(QueuedPlaceSchema),
});

export type Backup = z.infer<typeof BackupSchema>;

// Everything, archived and removed records included, so nothing is lost.
export function makeBackup(
  trip: TripData,
  items: PlanItem[],
  queue: QueuedPlace[],
  now: Date,
): Backup {
  return {
    version: 1,
    exportedAt: now.toISOString(),
    ...trip,
    items,
    queue,
  };
}

export function backupSummary(backup: Backup): string {
  const n = (count: number, one: string, many = `${one}s`) =>
    `${count} ${count === 1 ? one : many}`;
  return [
    n(backup.cities.length, "city", "cities"),
    n(backup.stays.length, "stay"),
    n(backup.reservations.length, "reservation"),
    n(backup.places.length, "place"),
    n(backup.items.filter((i) => i.status !== "removed").length, "stop"),
    n(backup.queue.length, "queued link"),
  ].join(", ");
}
