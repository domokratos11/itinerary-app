import { describe, expect, it } from "vitest";

import {
  isSkippable,
  isStepFilled,
  resumeStep,
  setupChecklist,
  setupSteps,
  type SetupInput,
} from "./setup";
import { EMPTY_TRIP } from "./trip";
import { fixtureTrip } from "@/test/fixture-trip";

const newTrip: SetupInput = {
  trip: { name: "Kyoto", members: ["ana@example.com"] },
  data: EMPTY_TRIP,
};
const dated: SetupInput = {
  ...newTrip,
  trip: { ...newTrip.trip, startDate: "2027-03-01", endDate: "2027-03-10" },
};
const flight = {
  ...({} as SetupInput["data"]["flights"][number]),
  id: "f1",
};

describe("setupSteps", () => {
  it("leaves out Start from until copying is possible", () => {
    expect(setupSteps({ canCopy: false })).toEqual([
      "details",
      "cities",
      "hotels",
      "flights",
      "people",
      "summary",
    ]);
    expect(setupSteps({ canCopy: true })).toContain("startFrom");
    expect(setupSteps({ canCopy: true }).indexOf("startFrom")).toBe(1);
  });

  it("lets every step but the name and dates be skipped", () => {
    expect(isSkippable("details")).toBe(false);
    expect(isSkippable("summary")).toBe(false);
    for (const step of [
      "startFrom",
      "cities",
      "hotels",
      "flights",
      "people",
    ] as const)
      expect(isSkippable(step)).toBe(true);
  });
});

describe("isStepFilled", () => {
  it("needs a name and both dates for the first step", () => {
    expect(isStepFilled("details", newTrip)).toBe(false);
    expect(isStepFilled("details", dated)).toBe(true);
    expect(
      isStepFilled("details", {
        ...dated,
        trip: { ...dated.trip, name: "  " },
      }),
    ).toBe(false);
    expect(
      isStepFilled("details", {
        ...dated,
        trip: { ...dated.trip, endDate: "2027-02-01" },
      }),
    ).toBe(false);
  });

  it("sees what the trip already holds", () => {
    const full: SetupInput = { ...dated, data: fixtureTrip };
    expect(isStepFilled("cities", full)).toBe(true);
    expect(isStepFilled("hotels", full)).toBe(true);
    expect(isStepFilled("flights", full)).toBe(false);
    expect(isStepFilled("startFrom", full)).toBe(true);
    expect(isStepFilled("startFrom", dated)).toBe(false);
    expect(isStepFilled("summary", full)).toBe(false);
  });

  it("counts other members, a budget or travellers as people", () => {
    expect(isStepFilled("people", dated)).toBe(false);
    expect(
      isStepFilled("people", {
        ...dated,
        trip: { ...dated.trip, members: ["ana@example.com", "luis@x.com"] },
      }),
    ).toBe(true);
    expect(
      isStepFilled("people", {
        ...dated,
        trip: {
          ...dated.trip,
          budget: {
            totalJPY: 100000,
            byCategory: {},
            travellers: null,
            byMember: {},
          },
        },
      }),
    ).toBe(true);
  });
});

describe("resumeStep", () => {
  const steps = setupSteps({ canCopy: false });

  it("starts a new trip at its name and dates", () => {
    expect(resumeStep(steps, newTrip)).toBe("details");
  });

  it("resumes at the first step with nothing in it", () => {
    expect(resumeStep(steps, dated)).toBe("cities");
    expect(
      resumeStep(steps, {
        ...dated,
        data: { ...EMPTY_TRIP, cities: fixtureTrip.cities },
      }),
    ).toBe("hotels");
    expect(resumeStep(steps, { ...dated, data: fixtureTrip })).toBe("flights");
  });

  it("ends at the summary when every step has something", () => {
    expect(
      resumeStep(steps, {
        trip: {
          ...dated.trip,
          members: ["ana@example.com", "luis@example.com"],
        },
        data: { ...fixtureTrip, flights: [flight] },
      }),
    ).toBe("summary");
  });
});

describe("setupChecklist", () => {
  it("lists the empty parts of an itinerary set up with the wizard", () => {
    expect(setupChecklist({ ...dated, setup: "done" })).toEqual([
      "cities",
      "hotels",
      "flights",
      "budget",
      "places",
    ]);
    expect(
      setupChecklist({ ...dated, data: fixtureTrip, setup: "done" }),
    ).toEqual(["flights", "budget", "places"]);
  });

  it("is empty when nothing is missing", () => {
    expect(
      setupChecklist({
        trip: {
          ...dated.trip,
          budget: {
            totalJPY: 1,
            byCategory: {},
            travellers: null,
            byMember: {},
          },
        },
        data: {
          ...fixtureTrip,
          flights: [flight],
          places: [{ id: "p1" } as SetupInput["data"]["places"][number]],
        },
        setup: "done",
      }),
    ).toEqual([]);
  });

  it("never shows for a trip made before the wizard", () => {
    expect(setupChecklist({ ...dated, setup: undefined })).toEqual([]);
    expect(setupChecklist({ ...dated, setup: null })).toEqual([]);
  });
});
