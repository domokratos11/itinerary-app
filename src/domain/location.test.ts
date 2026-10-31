import { describe, expect, it } from "vitest";

import {
  coordinatesExpired,
  doubtfulMatch,
  dueForRefresh,
  medianPoint,
  withoutGoogleCoordinates,
} from "./location";

const now = new Date("2026-12-20T00:00:00.000Z");
const fetched = (daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
const google = (daysAgo: number) => ({
  lat: 35.7,
  lng: 139.7,
  locationFetchedAt: fetched(daysAgo),
  locationSource: "google" as const,
});

describe("coordinate age", () => {
  it("expires Google coordinates at 30 days", () => {
    expect(coordinatesExpired(google(29), now)).toBe(false);
    expect(coordinatesExpired(google(30), now)).toBe(true);
  });

  it("never expires coordinates from anywhere else", () => {
    expect(
      coordinatesExpired(
        {
          lat: 35.7,
          lng: 139.7,
          locationFetchedAt: null,
          locationSource: "manual",
        },
        now,
      ),
    ).toBe(false);
  });

  it("refreshes old or missing Google coordinates, not manual ones", () => {
    expect(dueForRefresh(google(5), now)).toBe(false);
    expect(dueForRefresh(google(21), now)).toBe(true);
    expect(
      dueForRefresh(
        {
          lat: null,
          lng: null,
          locationFetchedAt: null,
          locationSource: null,
        },
        now,
      ),
    ).toBe(true);
    expect(
      dueForRefresh(
        {
          lat: 35,
          lng: 139,
          locationFetchedAt: null,
          locationSource: "manual",
        },
        now,
      ),
    ).toBe(false);
    expect(
      dueForRefresh(
        { lat: 35, lng: 139, locationFetchedAt: null, locationSource: null },
        now,
      ),
    ).toBe(false);
  });
});

describe("withoutGoogleCoordinates", () => {
  it("removes Google coordinates and keeps the rest", () => {
    const stripped = withoutGoogleCoordinates({
      ...google(1),
      googlePlaceId: "abc",
    });
    expect(stripped).toEqual({
      lat: null,
      lng: null,
      locationFetchedAt: null,
      locationSource: null,
      googlePlaceId: "abc",
    });
  });

  it("leaves manual coordinates alone", () => {
    const manual = {
      lat: 35,
      lng: 139,
      locationFetchedAt: null,
      locationSource: "manual" as const,
    };
    expect(withoutGoogleCoordinates(manual)).toBe(manual);
  });
});

describe("match checks", () => {
  const tokyo = { lat: 35.7, lng: 139.77 };
  const osaka = { lat: 34.69, lng: 135.5 };

  it("finds the median, which one outlier barely moves", () => {
    expect(medianPoint([])).toBeNull();
    expect(medianPoint([tokyo, tokyo, osaka])).toEqual(tokyo);
  });

  it("flags a match far from its city", () => {
    expect(
      doubtfulMatch({
        match: osaka,
        known: null,
        cityCentre: tokyo,
        category: "sight",
      }),
    ).toMatch(/from the rest of the city/);
  });

  it("allows day trips further away", () => {
    const kamakura = { lat: 35.32, lng: 139.55 };
    expect(
      doubtfulMatch({
        match: kamakura,
        known: null,
        cityCentre: tokyo,
        category: "daytrip",
      }),
    ).toBeNull();
  });

  it("flags a match away from known coordinates", () => {
    expect(
      doubtfulMatch({
        match: { lat: 35.75, lng: 139.77 },
        known: tokyo,
        cityCentre: null,
        category: null,
      }),
    ).toMatch(/coordinates we already have/);
  });
});
