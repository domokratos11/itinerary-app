import { describe, expect, it } from "vitest";

import { retiredItem, retiredPlace, retiredProposal } from "./places-reset";

const STAMP = "2026-11-01T00:00:00.000Z";

describe("retiredPlace", () => {
  it("archives a place and keeps coordinates entered by hand", () => {
    expect(
      retiredPlace(
        { archived: false, locationSource: "manual", lat: 35 },
        STAMP,
      ),
    ).toEqual({ archived: true, updatedAt: STAMP });
  });

  it("wipes coordinates from Google, even on an archived place", () => {
    expect(
      retiredPlace(
        { archived: true, locationSource: "google", lat: 35 },
        STAMP,
      ),
    ).toEqual({
      archived: true,
      updatedAt: STAMP,
      lat: null,
      lng: null,
      locationFetchedAt: null,
      locationSource: null,
    });
  });

  it("leaves a place that is already retired", () => {
    expect(retiredPlace({ archived: true, locationSource: null }, STAMP)).toBe(
      null,
    );
  });
});

describe("retiredItem", () => {
  it("removes every stop that isn't removed yet", () => {
    for (const status of ["planned", "done", "skipped"])
      expect(retiredItem({ status }, STAMP)).toEqual({
        status: "removed",
        updatedAt: STAMP,
      });
    expect(retiredItem({ status: "removed" }, STAMP)).toBe(null);
  });
});

describe("retiredProposal", () => {
  it("dismisses open proposals and leaves finished ones", () => {
    expect(retiredProposal({ status: "ready" }, STAMP)).toEqual({
      status: "dismissed",
      updatedAt: STAMP,
    });
    expect(retiredProposal({ status: "applied" }, STAMP)).toBe(null);
    expect(retiredProposal({ status: "dismissed" }, STAMP)).toBe(null);
  });
});
