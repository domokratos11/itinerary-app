import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DayPlan } from "@/components/day-plan";
import { testPlace } from "@/domain/test-place";
import { newPlanItem } from "@/domain/plan";
import { useAuthStore } from "@/lib/auth-store";
import { updateItem } from "@/lib/plan-actions";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/day/",
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/lib/use-walking-legs", () => ({
  useWalkingLegs: () => new Map(),
}));
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: { isConfigured: () => false },
}));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/plan-actions", () => ({
  addPlaceAt: vi.fn(),
  placeItem: vi.fn(),
  removeItem: vi.fn(),
  restoreItem: vi.fn(),
  updateItem: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/components/place-details", () => ({
  PlaceDetails: ({ place }: { place: { name: string } | null }) =>
    place && <div role="dialog">{place.name}</div>,
}));

const DATE = "2026-12-18";
const place = testPlace({ id: "zoo", name: "Ueno Zoo", cityId: "nagoya" });
const stop = newPlanItem({
  id: "s1",
  placeId: place.id,
  date: DATE,
  order: "a0",
  now: new Date("2026-11-01T00:00:00.000Z"),
});

function dayPlan() {
  render(
    <DayPlan
      date={DATE}
      label="Dec 18"
      cityNames={["Nagoya"]}
      cityIds={["nagoya"]}
      start={null}
      end={null}
      reservations={[]}
      flights={[]}
    />,
  );
}

describe("a stop in the day's plan", () => {
  beforeEach(() => {
    useTripStore.setState({ data: { ...fixtureTrip, places: [place] } });
    usePlanStore.setState({ items: [stop] });
    useAuthStore.setState({ tripId: "trip-1", access: "member" });
  });

  it("opens the place's details from its name", () => {
    dayPlan();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "See the details of Ueno Zoo" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Ueno Zoo");
  });

  it("has no panel for times or notes any more", () => {
    dayPlan();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
  });

  it.each([
    ["We went to Ueno Zoo", "done"],
    ["Skip Ueno Zoo", "skipped"],
  ])("marks it with %s", (name, status) => {
    dayPlan();
    fireEvent.click(screen.getByRole("button", { name }));
    expect(updateItem).toHaveBeenLastCalledWith("trip-1", stop, { status });
  });

  it("goes back to planned when the same button is tapped again", () => {
    usePlanStore.setState({ items: [{ ...stop, status: "done" }] });
    dayPlan();
    const went = screen.getByRole("button", { name: "We went to Ueno Zoo" });
    expect(went).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(went);
    expect(updateItem).toHaveBeenLastCalledWith(
      "trip-1",
      { ...stop, status: "done" },
      { status: "planned" },
    );
  });
});
