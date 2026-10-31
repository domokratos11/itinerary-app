import { describe, expect, it } from "vitest";

import { BackupSchema, backupSummary, makeBackup } from "@/domain/backup";
import { seed } from "@/lib/catalog";

describe("backup", () => {
  const backup = makeBackup(
    seed,
    [
      {
        id: "i1",
        placeId: seed.places[0].id,
        date: "2026-12-18",
        order: "a0",
        startTime: "10:00",
        durationMin: 60,
        note: null,
        status: "planned",
        legNote: null,
        updatedAt: "2026-11-01T00:00:00.000Z",
      },
    ],
    [],
    new Date("2026-11-02T00:00:00.000Z"),
  );

  it("round-trips through JSON and the schema", () => {
    const parsed = BackupSchema.parse(JSON.parse(JSON.stringify(backup)));
    expect(parsed).toEqual(backup);
  });

  it("rejects a file that isn't a backup", () => {
    expect(BackupSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("summarises what a backup holds", () => {
    expect(backupSummary(backup)).toBe(
      `6 cities, 6 stays, 4 reservations, ${seed.places.length} places, 1 stop, 0 queued links`,
    );
  });
});

describe("Google coordinates in backups", () => {
  const google = {
    ...seed.places[0],
    lat: 35.7,
    lng: 139.7,
    googlePlaceId: "abc",
    locationFetchedAt: "2026-11-01T00:00:00.000Z",
    locationSource: "google" as const,
  };

  it("leaves them out and keeps the place ID", () => {
    const backup = makeBackup(
      { ...seed, places: [google] },
      [],
      [],
      new Date("2026-11-02T00:00:00.000Z"),
    );
    expect(backup.places[0]).toMatchObject({
      lat: null,
      lng: null,
      googlePlaceId: "abc",
      locationSource: null,
    });
    expect(BackupSchema.safeParse(backup).success).toBe(true);
  });

  it("refuses a file that contains them", () => {
    const backup = makeBackup(seed, [], [], new Date());
    expect(
      BackupSchema.safeParse({ ...backup, places: [google] }).success,
    ).toBe(false);
  });
});
