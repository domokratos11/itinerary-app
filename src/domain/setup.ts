import { tripDatesOf } from "./schemas";
import type { TripData } from "./trip";
import type { TripSummary } from "./trip-repository";

// The setup wizard a new itinerary opens with, as pure step logic. The
// wizard itself is src/components/setup-wizard.tsx; nothing here is worded.

export const SETUP_STEPS = [
  "details",
  "startFrom",
  "cities",
  "hotels",
  "flights",
  "people",
  "summary",
] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

// What the steps look at: the trip document and its (active) records.
export type SetupInput = {
  trip: Pick<TripSummary, "name" | "members"> &
    Partial<Pick<TripSummary, "startDate" | "endDate" | "budget">>;
  data: Pick<TripData, "cities" | "stays" | "flights" | "places">;
};

// The steps in order. "Start from" only has something to offer when another
// itinerary can be copied; with "Start empty" alone it is left out.
export function setupSteps(options: { canCopy: boolean }): SetupStep[] {
  return SETUP_STEPS.filter((step) => step !== "startFrom" || options.canCopy);
}

// Everything but the name and dates (the days need them) can be skipped.
// The summary is the end, not a step to skip.
export function isSkippable(step: SetupStep): boolean {
  return step !== "details" && step !== "summary";
}

function hasContent(data: SetupInput["data"]): boolean {
  return (
    data.cities.length > 0 ||
    data.stays.length > 0 ||
    data.flights.length > 0 ||
    data.places.length > 0
  );
}

// Whether a step already has something in it.
export function isStepFilled(step: SetupStep, input: SetupInput): boolean {
  const { trip, data } = input;
  switch (step) {
    case "details":
      return (
        (trip.name ?? "").trim() !== "" &&
        tripDatesOf({ startDate: trip.startDate, endDate: trip.endDate }) !==
          null
      );
    // Answered once anything is in the trip, whether copied or added.
    case "startFrom":
      return hasContent(data);
    case "cities":
      return data.cities.length > 0;
    case "hotels":
      return data.stays.length > 0;
    case "flights":
      return data.flights.length > 0;
    case "people":
      return (
        trip.members.length > 1 ||
        trip.budget?.totalJPY != null ||
        trip.budget?.travellers != null
      );
    case "summary":
      return false;
  }
}

// Where reopening the wizard starts: the first step with nothing in it, or
// the summary when every step has something.
export function resumeStep(
  steps: readonly SetupStep[],
  input: SetupInput,
): SetupStep {
  return steps.find((step) => !isStepFilled(step, input)) ?? "summary";
}

// The parts of a set-up itinerary the Dashboard's "Finish setting up" card
// lists while they are empty.
export const SETUP_PARTS = [
  "cities",
  "hotels",
  "flights",
  "budget",
  "places",
] as const;

export type SetupPart = (typeof SETUP_PARTS)[number];

// The parts still empty. Only for itineraries that went through the wizard
// (their `setup` field is present): a trip made before it never gets the card.
export function setupChecklist(
  input: SetupInput & { setup: TripSummary["setup"] },
): SetupPart[] {
  if (input.setup == null) return [];
  const { trip, data } = input;
  const empty: Record<SetupPart, boolean> = {
    cities: data.cities.length === 0,
    hotels: data.stays.length === 0,
    flights: data.flights.length === 0,
    budget: trip.budget?.totalJPY == null,
    places: data.places.length === 0,
  };
  return SETUP_PARTS.filter((part) => empty[part]);
}
