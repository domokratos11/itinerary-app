import { describe, expect, it, vi } from "vitest";

import { retiredFields } from "./items-clean";

vi.mock("./admin-db", () => ({ adminDb: vi.fn() }));

describe("retiredFields", () => {
  it("finds the old stop details, empty or filled in", () => {
    expect(
      retiredFields({
        id: "a",
        status: "done",
        startTime: "10:00",
        durationMin: null,
        note: null,
        legNote: null,
      }),
    ).toEqual({
      present: ["startTime", "durationMin", "note", "legNote"],
      filled: ["startTime"],
    });
  });

  it("leaves a cleaned stop and its other fields alone", () => {
    expect(retiredFields({ id: "a", placeId: "p", status: "planned" })).toEqual(
      { present: [], filled: [] },
    );
  });
});
