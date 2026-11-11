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
vi.mock("@/components/trip-map", () => ({
  TripMap: ({
    pins,
    note,
    toolbar,
  }: {
    pins: { title: string }[];
    note: string | null;
    toolbar?: React.ReactNode;
  }) => (
    <>
      <div role="figure">
        {pins.map((pin) => pin.title).join(", ")}|{note}
      </div>
      {toolbar}
    </>
  ),
}));
vi.mock("@/components/place-details", () => ({
  PlaceDetails: ({ place }: { place: { name: string } | null }) =>
    place && <div role="dialog">{place.name}</div>,
}));

const DATE = "2026-12-18";
const place = testPlace({
  id: "zoo",
  name: "Ueno Zoo",
  cityId: "nagoya",
  lat: 35.7,
  lng: 139.7,
});
const castle = testPlace({
  id: "castle",
  name: "Nagoya Castle",
  cityId: "nagoya",
  category: "sight",
  priority: "must",
  lat: 35.18,
  lng: 136.9,
});
const market = testPlace({
  id: "market",
  name: "Morning Market",
  cityId: "nagoya",
  category: "food",
  priority: "maybe",
  lat: null,
  lng: null,
});
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
    useTripStore.setState({
      data: { ...fixtureTrip, places: [place, castle, market] },
    });
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

  it("shows waiting places on the map only when asked", () => {
    dayPlan();
    fireEvent.click(screen.getByRole("radio", { name: "Map" }));
    expect(screen.getByRole("figure")).toHaveTextContent("Ueno Zoo");
    expect(screen.getByRole("figure")).not.toHaveTextContent("Nagoya Castle");

    fireEvent.click(screen.getByRole("radio", { name: "Waiting (2)" }));
    const show = screen.getByRole("button", { name: "Show on map" });
    expect(show).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(show);

    // Phones go to the map to see them, and can turn them off from there.
    const map = screen.getByRole("figure");
    expect(map).toHaveTextContent("Ueno Zoo, Nagoya Castle");
    expect(map).toHaveTextContent("1 waiting place has no map pin yet.");
    fireEvent.click(screen.getByRole("button", { name: "Hide from map" }));
    expect(screen.getByRole("figure")).not.toHaveTextContent("Nagoya Castle");
  });

  it("says which legs go to and from the hotel, and warns with no location", () => {
    render(
      <DayPlan
        date={DATE}
        label="Dec 18"
        cityNames={["Nagoya"]}
        cityIds={["nagoya"]}
        start={{ name: "Sample Hotel", location: { query: "Sample Hotel" } }}
        end={{ name: "Sample Hotel", location: { query: "Sample Hotel" } }}
        reservations={[]}
        flights={[]}
      />,
    );
    expect(screen.getByText("From Sample Hotel")).toBeInTheDocument();
    expect(screen.getByText("Back to Sample Hotel")).toBeInTheDocument();
    expect(
      screen.getByText(/Sample Hotel isn't on the map/),
    ).toBeInTheDocument();
  });

  it("doesn't warn about a hotel that is on the map", () => {
    const hotel = { name: "Sample Hotel", location: { lat: 35.7, lng: 139.7 } };
    render(
      <DayPlan
        date={DATE}
        label="Dec 18"
        cityNames={["Nagoya"]}
        cityIds={["nagoya"]}
        start={hotel}
        end={hotel}
        reservations={[]}
        flights={[]}
      />,
    );
    expect(screen.queryByText(/isn't on the map/)).toBeNull();
    expect(screen.getByText("From Sample Hotel")).toBeInTheDocument();
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

describe("hotels on the day's map", () => {
  const morning = { name: "Tokyo Inn", location: { lat: 35.68, lng: 139.76 } };
  const night = { name: "Kyoto Ryokan", location: { lat: 35.0, lng: 135.77 } };

  beforeEach(() => {
    useTripStore.setState({ data: { ...fixtureTrip, places: [place] } });
    usePlanStore.setState({ items: [stop] });
    useAuthStore.setState({ tripId: "trip-1", access: "member" });
  });

  function movingDay() {
    render(
      <DayPlan
        date={DATE}
        label="Dec 18"
        cityNames={["Tokyo", "Kyoto"]}
        cityIds={["nagoya"]}
        start={morning}
        end={night}
        reservations={[]}
        flights={[]}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Map" }));
  }

  it("leaves them off until asked for", () => {
    movingDay();
    expect(screen.getByRole("figure")).toHaveTextContent("Ueno Zoo");
    expect(screen.getByRole("figure")).not.toHaveTextContent("Tokyo Inn");
    expect(screen.getByRole("checkbox", { name: "Show hotel" })).not.toBeChecked();
  });

  it("shows both on a moving day, and either one alone", () => {
    movingDay();
    fireEvent.click(screen.getByRole("checkbox", { name: "Show hotel" }));
    expect(screen.getByRole("figure")).toHaveTextContent(
      "Tokyo Inn, Ueno Zoo, Kyoto Ryokan",
    );
    fireEvent.click(screen.getByRole("button", { name: "Night: Kyoto Ryokan" }));
    expect(screen.getByRole("figure")).toHaveTextContent("Tokyo Inn, Ueno Zoo");
    expect(screen.getByRole("figure")).not.toHaveTextContent("Kyoto Ryokan");
    fireEvent.click(screen.getByRole("button", { name: "Morning: Tokyo Inn" }));
    expect(screen.getByRole("checkbox", { name: "Show hotel" })).not.toBeChecked();
  });
});
