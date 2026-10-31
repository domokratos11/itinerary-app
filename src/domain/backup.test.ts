import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n";

import { BackupSchema, backupSummary, makeBackup } from "@/domain/backup";
import { testPlace } from "@/domain/test-place";
import { fixtureTrip } from "@/test/fixture-trip";

const place = testPlace();
const trip = { ...fixtureTrip, places: [place] };

describe("backup", () => {
  const backup = makeBackup(
    trip,
    [
      {
        id: "i1",
        placeId: place.id,
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
    expect(backupSummary(backup, t)).toBe(
      "2 cities, 2 stays, 1 reservation, 1 place, 1 stop",
    );
  });

  it("ignores the queue in a backup from when there was one", () => {
    const older = {
      ...JSON.parse(JSON.stringify(backup)),
      queue: [{ id: "q" }],
    };
    expect(BackupSchema.parse(older)).not.toHaveProperty("queue");
  });

  it("still reads a backup from before holidays moved into the trip", () => {
    const older = JSON.parse(JSON.stringify(backup));
    delete older.holidays;
    expect(BackupSchema.parse(older).holidays).toEqual([]);
  });
});

describe("Google coordinates in backups", () => {
  const google = {
    ...place,
    lat: 35.7,
    lng: 139.7,
    googlePlaceId: "abc",
    locationFetchedAt: "2026-11-01T00:00:00.000Z",
    locationSource: "google" as const,
  };

  it("leaves them out and keeps the place ID", () => {
    const backup = makeBackup(
      { ...fixtureTrip, places: [google] },
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
    const backup = makeBackup(fixtureTrip, [], new Date());
    expect(
      BackupSchema.safeParse({ ...backup, places: [google] }).success,
    ).toBe(false);
  });
});
