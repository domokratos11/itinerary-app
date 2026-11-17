import { describe, expect, it } from "vitest";

import {
  applyCityResult,
  cancelCityRequest,
  citiesInTripOrder,
  cityResearchRequests,
  CityNotesSchema,
  CityResultSchema,
  requestCityNotes,
} from "@/domain/city-notes";
import { TripDataSchema } from "@/domain/schemas";
import fixture from "@/test/fixture-trip.json";
import { SAMPLE_BRIEF } from "@/test/sample-city-notes";

const trip = TripDataSchema.parse(fixture);
const now = new Date("2026-12-01T10:00:00.000Z");
const later = new Date("2026-12-02T10:00:00.000Z");

describe("requestCityNotes", () => {
  it("asks with an optional message and keeps the notes already there", () => {
    const first = applyCityResult(
      null,
      { cityId: "nagoya", notes: SAMPLE_BRIEF, answer: null },
      now,
    )!;
    const row = requestCityNotes(
      "nagoya",
      "  What about the castle? ",
      first,
      later,
    );
    expect(row.status).toBe("requested");
    expect(row.request).toBe("What about the castle?");
    expect(row.notes).toEqual(first.notes);
    expect(CityNotesSchema.safeParse(row).success).toBe(true);
  });

  it("can be cancelled", () => {
    const asked = requestCityNotes("nagoya", "", null, now);
    expect(asked.request).toBeNull();
    expect(cancelCityRequest(asked, later).status).toBe("archived");
  });
});

describe("applyCityResult", () => {
  it("stores the notes as ready", () => {
    const row = applyCityResult(
      null,
      { cityId: "nagoya", notes: SAMPLE_BRIEF, answer: null },
      now,
    )!;
    expect(row.status).toBe("ready");
    expect(row.notes?.answers).toEqual([]);
    expect(CityNotesSchema.parse(row)).toEqual(row);
  });

  it("adds the answer to the open question and keeps earlier ones", () => {
    const ready = applyCityResult(
      null,
      { cityId: "nagoya", notes: SAMPLE_BRIEF, answer: null },
      now,
    )!;
    const asked = requestCityNotes("nagoya", "Why the castle?", ready, now);
    const answered = applyCityResult(
      asked,
      {
        cityId: "nagoya",
        notes: null,
        answer: { en: "Because of the lord.", es: "Por el señor feudal." },
      },
      later,
    )!;
    expect(answered.request).toBeNull();
    expect(answered.notes?.answers).toHaveLength(1);
    expect(answered.notes?.answers[0].question).toBe("Why the castle?");
    expect(answered.notes?.researchedAt).toBe(ready.notes?.researchedAt);
  });

  it("applies nothing without notes", () => {
    expect(
      applyCityResult(
        null,
        { cityId: "nagoya", notes: null, answer: null },
        now,
      ),
    ).toBeNull();
  });

  it("refuses untranslated text in a result", () => {
    const copy = structuredClone(SAMPLE_BRIEF);
    copy.season.es = copy.season.en;
    expect(
      CityResultSchema.safeParse({ cityId: "x", notes: copy, answer: null })
        .success,
    ).toBe(false);
  });
});

describe("cityResearchRequests", () => {
  const notes = [
    requestCityNotes("nagoya", "Food?", null, now),
    applyCityResult(
      null,
      { cityId: "tokyo-ueno", notes: SAMPLE_BRIEF, answer: null },
      now,
    )!,
  ];

  it("lists what was asked, with its dates and places", () => {
    const requests = cityResearchRequests(
      { ...trip, notes },
      { missing: false },
    );
    expect(requests.map((r) => r.cityId)).toEqual(["nagoya"]);
    expect(requests[0].request).toBe("Food?");
  });

  it("with missing, adds every city without notes", () => {
    const ids = cityResearchRequests({ ...trip, notes }, { missing: true }).map(
      (r) => r.cityId,
    );
    expect(ids).toContain("nagoya");
    expect(ids).not.toContain("tokyo-ueno");
    const tokyo = cityResearchRequests(
      { ...trip, notes: [] },
      { missing: true, only: "tokyo-ueno" },
    );
    expect(tokyo).toHaveLength(1);
    expect(tokyo[0].from).toBe("2026-12-17");
  });
});

describe("citiesInTripOrder", () => {
  it("orders cities by their first night", () => {
    const order = citiesInTripOrder(trip.cities, trip.stays).map((c) => c.id);
    expect(order[0]).toBe("tokyo-ueno");
  });
});
