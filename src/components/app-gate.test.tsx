import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { AppGate, OFFLINE_GRACE_MS } from "@/components/app-gate";
import { signInWithGoogle } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth-store";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";
import { useViewerStore } from "@/lib/viewer-store";

vi.mock("@/lib/auth", () => ({ signInWithGoogle: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: { isConfigured: () => false },
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const user = { uid: "u1", email: "ana@example.com", name: "Ana" };
const trip = (id: string, name: string | null = id) => ({
  id,
  name,
  members: [user.email],
});
const allLoaded = {
  cities: true,
  stays: true,
  reservations: true,
  places: true,
  holidays: true,
  expenses: true,
  flights: true,
  cash: true,
  todoLists: true,
  todos: true,
};

function renderGate() {
  return render(
    <AppGate>
      <p>the app</p>
    </AppGate>,
  );
}

const app = () => screen.queryByText("the app");

describe("AppGate", () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: "loading",
      user: null,
      trips: null,
      tripsFailed: false,
      canCreateTrips: false,
      tripId: null,
      tripChosen: false,
      access: "checking",
    });
    useTripStore.getState().reset();
    usePlanStore.getState().reset();
    vi.mocked(signInWithGoogle).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  describe("offline", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      useAuthStore.setState({
        status: "signed-in",
        user,
        trips: [trip("t1")],
        tripId: "t1",
        tripChosen: true,
        access: "checking",
      });
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    // The device's copy usually answers at once: no offline screen flashes.
    it("opens the trip from the device's copy", () => {
      useTripStore.setState({ loaded: allLoaded });
      usePlanStore.setState({ ready: true });
      renderGate();
      expect(screen.queryByRole("dialog")).toBeNull();
      act(() => useAuthStore.setState({ access: "member" }));
      expect(app()).toBeInTheDocument();
    });

    it("says it is offline only when no copy answers", () => {
      renderGate();
      expect(screen.queryByRole("dialog")).toBeNull();
      act(() => vi.advanceTimersByTime(OFFLINE_GRACE_MS));
      expect(screen.getByRole("dialog")).toHaveTextContent("You're offline");
    });
  });

  it("shows nothing of the app while sign-in is still loading", () => {
    renderGate();
    expect(app()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks for sign-in with or without a trip", () => {
    useAuthStore.setState({ status: "signed-out" });
    renderGate();
    expect(app()).toBeNull();
    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeInTheDocument();
  });

  it("shows why a sign-in failed", async () => {
    useAuthStore.setState({ status: "signed-out" });
    vi.mocked(signInWithGoogle).mockRejectedValue(new Error("Blocked pop-up"));
    renderGate();
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Blocked pop-up", {
        action: expect.objectContaining({ label: "Try again" }),
      }),
    );
  });

  it("waits for the trip list after sign-in", () => {
    useAuthStore.setState({ status: "signed-in", user });
    renderGate();
    expect(app()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says so when the account has no trips", () => {
    useAuthStore.setState({ status: "signed-in", user, trips: [] });
    renderGate();
    expect(app()).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "No trips yet" }),
    ).toHaveTextContent("ana@example.com");
    expect(screen.queryByRole("button", { name: "New itinerary" })).toBeNull();
  });

  it("offers a new trip only to someone allowed to create one", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [],
      canCreateTrips: true,
    });
    renderGate();
    expect(
      screen.getByRole("button", { name: "New itinerary" }),
    ).toBeInTheDocument();
  });

  it("asks which trip when there are several", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [trip("japan", "Japan"), trip("peru", null)],
      tripChosen: true,
    });
    renderGate();
    expect(app()).toBeNull();
    expect(screen.getByRole("button", { name: "Japan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My trip" })).toBeInTheDocument();
  });

  it("shows each trip's dates and whether it is set up", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [
        {
          ...trip("japan", "Japan"),
          startDate: "2026-12-15",
          endDate: "2027-01-12",
        },
        { ...trip("peru", "Peru"), setup: "pending" },
      ],
      tripChosen: true,
      canCreateTrips: true,
    });
    renderGate();
    const japan = screen.getByRole("button", { name: /Japan/ });
    expect(japan).toHaveTextContent("Dec 15, 2026");
    expect(japan).toHaveTextContent("Jan 12, 2027");
    expect(japan).not.toHaveTextContent("Not set up yet");
    expect(screen.getByRole("button", { name: /Peru/ })).toHaveTextContent(
      "Not set up yet",
    );
    expect(
      screen.getByRole("button", { name: "New itinerary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("lists a single trip when none was opened (All itineraries)", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [trip("japan", "Japan")],
      tripChosen: true,
      canCreateTrips: true,
    });
    renderGate();
    expect(app()).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Choose an itinerary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Japan" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New itinerary" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "No trips yet" })).toBeNull();
  });

  it("keeps the splash while a trip is being chosen from the list", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [trip("japan")],
    });
    renderGate();
    expect(app()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the splash until the plan has arrived", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [trip("trip-1")],
      tripId: "trip-1",
      tripChosen: true,
      access: "member",
    });
    useTripStore.setState({ loaded: allLoaded });
    renderGate();
    expect(app()).toBeNull();
  });

  it("names the account that isn't a member", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [],
      tripId: "trip-1",
      access: "denied",
    });
    renderGate();
    expect(app()).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Not on this trip" }),
    ).toHaveTextContent("ana@example.com");
    expect(
      screen.getByRole("button", { name: "Use another account" }),
    ).toBeInTheDocument();
  });

  it("waits for the trip's data once access is confirmed", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [trip("trip-1")],
      tripId: "trip-1",
      access: "member",
    });
    renderGate();
    expect(app()).toBeNull();
  });

  describe("the setup wizard", () => {
    function openTripWith(setup?: "pending" | "done") {
      useAuthStore.setState({
        status: "signed-in",
        user,
        trips: [
          { ...trip("trip-1", "Kyoto"), ...(setup !== undefined && { setup }) },
        ],
        tripId: "trip-1",
        tripChosen: true,
        access: "member",
      });
      useTripStore.setState({ loaded: allLoaded });
      usePlanStore.getState().setItems([]);
    }
    const wizard = () => screen.queryByRole("main", { name: "Kyoto" });

    afterEach(() => useViewerStore.setState({ status: "off", share: null }));

    it("shows instead of the app while setup is pending", () => {
      openTripWith("pending");
      renderGate();
      expect(app()).toBeNull();
      expect(wizard()).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Name and dates" }),
      ).toBeInTheDocument();
    });

    it("never shows for a trip without setup, or once it is done", () => {
      openTripWith();
      const { unmount } = renderGate();
      expect(app()).toBeInTheDocument();
      expect(wizard()).toBeNull();
      unmount();
      openTripWith("done");
      renderGate();
      expect(app()).toBeInTheDocument();
      expect(wizard()).toBeNull();
    });

    it("never shows on a read-only link", () => {
      openTripWith("pending");
      useViewerStore.setState({ status: "active" });
      renderGate();
      expect(app()).toBeInTheDocument();
      expect(wizard()).toBeNull();
    });

    it("waits, like the app, until the trip has arrived", () => {
      openTripWith("pending");
      useTripStore.getState().reset();
      renderGate();
      expect(wizard()).toBeNull();
      expect(app()).toBeNull();
    });
  });

  it("opens the app for a member once the data has arrived", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [trip("trip-1")],
      tripId: "trip-1",
      access: "member",
    });
    useTripStore.setState({ loaded: allLoaded });
    usePlanStore.getState().setItems([]);
    renderGate();
    expect(app()).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
