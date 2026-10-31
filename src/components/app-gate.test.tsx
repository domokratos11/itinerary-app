import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { AppGate } from "@/components/app-gate";
import { signInWithGoogle } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth-store";
import { useTripStore } from "@/lib/trip-store";

vi.mock("@/lib/auth", () => ({ signInWithGoogle: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
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
      access: "checking",
    });
    useTripStore.getState().reset();
    vi.mocked(signInWithGoogle).mockReset();
    vi.mocked(toast.error).mockReset();
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
      expect(toast.error).toHaveBeenCalledWith("Blocked pop-up"),
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
    expect(screen.queryByRole("button", { name: "New trip" })).toBeNull();
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
      screen.getByRole("button", { name: "New trip" }),
    ).toBeInTheDocument();
  });

  it("asks which trip when there are several", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [trip("japan", "Japan"), trip("peru", null)],
    });
    renderGate();
    expect(app()).toBeNull();
    expect(screen.getByRole("button", { name: "Japan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My trip" })).toBeInTheDocument();
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

  it("opens the app for a member once the data has arrived", () => {
    useAuthStore.setState({
      status: "signed-in",
      user,
      trips: [trip("trip-1")],
      tripId: "trip-1",
      access: "member",
    });
    useTripStore.setState({ loaded: allLoaded });
    renderGate();
    expect(app()).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
