import { describe, expect, it } from "vitest";

import { seed } from "@/lib/catalog";
import {
  applyPlaceEdit,
  changedFields,
  formToChanges,
  matchesPlaceFilter,
  missingFields,
  newDraftPlace,
  placeToForm,
  validatePlaceForm,
} from "./place-edit";
import type { PlaceRecord } from "./schemas";

const now = new Date("2026-11-10T00:00:00.000Z");
const place: PlaceRecord = {
  ...seed.places[0],
  lat: 35.7,
  lng: 139.7,
  googlePlaceId: "abc",
  locationSource: "google",
  locationFetchedAt: "2026-11-01T00:00:00.000Z",
  costEstimateJPY: null,
  openingHours: "10:00-17:00",
  lockedFields: [],
};
const unchanged = formToChanges(placeToForm(place));

describe("changedFields", () => {
  it("finds nothing when the form is untouched", () => {
    expect(changedFields(place, unchanged)).toEqual([]);
  });

  it("names what changed", () => {
    expect(
      changedFields(place, { ...unchanged, costEstimateJPY: 600 }),
    ).toEqual(["costEstimateJPY"]);
  });
});

describe("applyPlaceEdit", () => {
  it("locks edited fields and keeps earlier locks", () => {
    const edited = applyPlaceEdit(
      { ...place, lockedFields: ["notes"] },
      { ...unchanged, costEstimateJPY: 600 },
      now,
    );
    expect(edited.costEstimateJPY).toBe(600);
    expect(edited.lockedFields).toEqual(["notes", "costEstimateJPY"]);
  });

  it("leaves Google's coordinates alone when they weren't touched", () => {
    const edited = applyPlaceEdit(place, unchanged, now);
    expect(edited.locationSource).toBe("google");
    expect(edited.locationFetchedAt).toBe(place.locationFetchedAt);
  });

  it("makes typed coordinates manual", () => {
    const edited = applyPlaceEdit(place, { ...unchanged, lat: 35.8 }, now);
    expect(edited.locationSource).toBe("manual");
    expect(edited.locationFetchedAt).toBeNull();
    expect(edited.lockedFields).toContain("location");
  });
});

describe("validatePlaceForm", () => {
  const form = placeToForm(place);

  it("accepts a valid form and splits the lists", () => {
    const result = validatePlaceForm(
      place,
      {
        ...form,
        tips: "Go early\n\nBring cash",
        closedDates: "2026-12-29, 2026-12-30",
        stationName: "Ueno Station",
        stationLines: "Ginza Line, Hibiya Line",
        stationWalk: "4",
      },
      now,
    );
    expect(result.ok && result.place.tips).toEqual(["Go early", "Bring cash"]);
    expect(result.ok && result.place.closedDates).toHaveLength(2);
    expect(result.ok && result.place.nearestStation).toEqual({
      name: "Ueno Station",
      lines: ["Ginza Line", "Hibiya Line"],
      walkMin: 4,
    });
  });

  it("refuses bad values", () => {
    expect(validatePlaceForm(place, { ...form, name: "" }, now).ok).toBe(false);
    expect(validatePlaceForm(place, { ...form, cost: "-1" }, now).ok).toBe(
      false,
    );
    expect(
      validatePlaceForm(place, { ...form, closedDates: "soon" }, now).ok,
    ).toBe(false);
    expect(validatePlaceForm(place, { ...form, lng: "" }, now).ok).toBe(false);
  });
});

describe("completeness", () => {
  it("works from empty fields, not the stored status", () => {
    const empty = {
      ...place,
      status: "researched" as const,
      description: null,
      costEstimateJPY: null,
      durationMin: null,
      openingHours: null,
      websiteUrl: null,
      nearestStation: null,
    };
    expect(missingFields(empty)).toHaveLength(6);
    expect(matchesPlaceFilter(empty, "needs-research", new Set())).toBe(true);
  });

  it("filters by what's missing and what's waiting for review", () => {
    const none = new Set<string>();
    expect(matchesPlaceFilter(place, "missing-cost", none)).toBe(true);
    expect(matchesPlaceFilter(place, "missing-hours", none)).toBe(false);
    expect(matchesPlaceFilter(place, "no-pin", none)).toBe(false);
    expect(matchesPlaceFilter(place, "review", none)).toBe(false);
    expect(matchesPlaceFilter(place, "review", new Set([place.id]))).toBe(true);
  });
});

describe("newDraftPlace", () => {
  const base = {
    name: " Ueno Zoo ",
    cityId: "tokyo-ueno",
    category: "sight" as const,
    priority: "want" as const,
    mapsUrl: null,
    takenIds: ["ueno-zoo"],
  };

  it("records Google's coordinates with their date", () => {
    const made = newDraftPlace(
      {
        ...base,
        lat: 35.7,
        lng: 139.7,
        googlePlaceId: "abc",
        fromGoogle: true,
      },
      now,
    );
    expect(made.id).toBe("ueno-zoo-2");
    expect(made.name).toBe("Ueno Zoo");
    expect(made.status).toBe("draft");
    expect(made.locationSource).toBe("google");
    expect(made.locationFetchedAt).toBe(now.toISOString());
    expect(made.mapsUrl).toContain("query_place_id=abc");
  });

  it("treats coordinates from a pasted link as manual", () => {
    const made = newDraftPlace(
      {
        ...base,
        lat: 35.7,
        lng: 139.7,
        googlePlaceId: null,
        fromGoogle: false,
      },
      now,
    );
    expect(made.locationSource).toBe("manual");
    expect(made.locationFetchedAt).toBeNull();
  });
});
