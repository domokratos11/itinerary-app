import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "@/components/dashboard-screen";
import type { TripSummary } from "@/domain/trip-repository";
import { useAuthStore } from "@/lib/auth-store";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";
import { useViewerStore } from "@/lib/viewer-store";
import { testPlace } from "@/domain/test-place";
import { fixtureTrip } from "@/test/fixture-trip";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/lib/use-proposals", () => ({ useProposals: () => [] }));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: { isConfigured: () => false },
}));

const TRIP_ID = "trip-1";
const budget = {
  totalJPY: 100000,
  byCategory: {},
  travellers: null,
  byMember: {},
};
const flight = {
  id: "f1",
  airline: "Sample Air",
  flightNumber: "SA1",
  departDate: "2026-12-17",
  departTime: "10:00",
  departAirport: "LAX",
  departCity: "Los Angeles",
  arriveDate: "2026-12-18",
  arriveTime: "15:00",
  arriveAirport: "HND",
  arriveCity: "Tokyo",
  confirmation: null,
  costAmount: null,
  costCurrency: "USD" as const,
  note: null,
  archived: false,
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function openTrip(extra: Partial<TripSummary>) {
  useAuthStore.setState({
    status: "signed-in",
    tripId: TRIP_ID,
    access: "member",
    trips: [
      { id: TRIP_ID, name: "Kyoto", members: ["ana@example.com"], ...extra },
    ],
  });
}

const card = () => screen.queryByText("Finish setting up");

describe("the Dashboard's Finish setting up card", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-01T00:00:00.000Z"));
    window.localStorage.clear();
    useTripStore.setState({ data: fixtureTrip });
    usePlanStore.setState({ items: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
    useViewerStore.setState({ status: "off", share: null });
  });

  it("lists the empty parts with links to fill them in", () => {
    openTrip({ setup: "done" });
    render(<DashboardScreen />);
    expect(card()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add flights" })).toHaveAttribute(
      "href",
      expect.stringMatching(/settings\/?\?tab=flights&trip=trip-1/),
    );
    expect(screen.getByRole("link", { name: "Set a budget" })).toHaveAttribute(
      "href",
      expect.stringMatching(/budget\/?\?trip=trip-1/),
    );
    expect(
      screen.getByRole("link", { name: "Add places" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add cities" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Add hotels" })).toBeNull();
  });

  it("replaces the empty Dashboard of a new itinerary", () => {
    useTripStore.getState().reset();
    openTrip({ setup: "done" });
    render(<DashboardScreen />);
    expect(card()).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add cities" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/This trip has nothing in it yet/)).toBeNull();
  });

  it("goes away when nothing is missing", () => {
    useTripStore.setState({
      data: {
        ...fixtureTrip,
        flights: [flight],
        places: [testPlace({ cityId: "tokyo-ueno" })],
      },
    });
    openTrip({ setup: "done", budget });
    render(<DashboardScreen />);
    expect(card()).toBeNull();
  });

  it("never shows for a trip made before the wizard", () => {
    openTrip({});
    render(<DashboardScreen />);
    expect(card()).toBeNull();
  });

  it("never shows on a read-only link", () => {
    openTrip({ setup: "done" });
    useViewerStore.setState({ status: "active" });
    render(<DashboardScreen />);
    expect(card()).toBeNull();
  });

  it("can be hidden for this itinerary", () => {
    openTrip({ setup: "done" });
    const { unmount } = render(<DashboardScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "Hide this checklist" }),
    );
    expect(card()).toBeNull();
    unmount();
    render(<DashboardScreen />);
    expect(card()).toBeNull();
    // Another itinerary keeps its own.
    act(() =>
      useAuthStore.setState({
        tripId: "trip-2",
        trips: [{ id: "trip-2", name: "Osaka", members: [], setup: "done" }],
      }),
    );
    expect(card()).toBeInTheDocument();
  });
});
