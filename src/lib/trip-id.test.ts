import { beforeEach, describe, expect, it } from "vitest";

import {
  chooseTrip,
  forgetTripId,
  parseTripId,
  recallTripId,
  rememberTripId,
} from "@/lib/trip-id";

const A = "tripAAAAAA";
const B = "tripBBBBBB";

describe("parseTripId", () => {
  it("accepts a Firestore auto-ID", () => {
    expect(parseTripId("Ab3dE9fG1hJ2kL4mN5pQ")).toBe("Ab3dE9fG1hJ2kL4mN5pQ");
  });

  it("rejects empty, short or path-like values", () => {
    expect(parseTripId(null)).toBeNull();
    expect(parseTripId("abc")).toBeNull();
    expect(parseTripId("trips/abc123")).toBeNull();
  });
});

describe("remembered trip", () => {
  beforeEach(() => window.localStorage.clear());

  it("is kept and forgotten", () => {
    expect(recallTripId()).toBeNull();
    rememberTripId(A);
    expect(recallTripId()).toBe(A);
    forgetTripId();
    expect(recallTripId()).toBeNull();
  });
});

describe("chooseTrip", () => {
  const none = { fromUrl: null, remembered: null, lastTripId: null };

  it("tries a link even when it isn't one of the user's trips", () => {
    expect(chooseTrip({ ...none, fromUrl: B, trips: [A] })).toBe(B);
  });

  it("prefers the remembered trip, then the last one used on any device", () => {
    expect(
      chooseTrip({ ...none, remembered: B, lastTripId: A, trips: [A, B] }),
    ).toBe(B);
    expect(chooseTrip({ ...none, lastTripId: A, trips: [A, B] })).toBe(A);
  });

  it("ignores a remembered trip the user is no longer on", () => {
    expect(chooseTrip({ ...none, remembered: B, trips: [A] })).toBe(A);
  });

  it("opens the only trip, and leaves several for the user to pick", () => {
    expect(chooseTrip({ ...none, trips: [A] })).toBe(A);
    expect(chooseTrip({ ...none, trips: [A, B] })).toBeNull();
    expect(chooseTrip({ ...none, trips: [] })).toBeNull();
  });

  it("falls back to the remembered trip when the list can't be read", () => {
    expect(chooseTrip({ ...none, remembered: A, trips: null })).toBe(A);
    expect(chooseTrip({ ...none, trips: null })).toBeNull();
  });
});
