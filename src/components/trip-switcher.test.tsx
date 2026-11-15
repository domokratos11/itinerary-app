import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TripSwitcher } from "@/components/trip-switcher";
import { useAuthStore } from "@/lib/auth-store";
import { openTrip, openTripPicker } from "@/lib/trip-id";

vi.mock("@/lib/trip-id", () => ({
  openTrip: vi.fn(),
  openTripPicker: vi.fn(),
}));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));

const members = ["ana@example.com"];
const japan = {
  id: "japan",
  name: "Japan",
  members,
  startDate: "2026-12-15",
  endDate: "2027-01-12",
};
const peru = { id: "peru", name: "Peru", members, setup: "pending" as const };

describe("TripSwitcher", () => {
  beforeEach(() => {
    vi.mocked(openTrip).mockReset();
    vi.mocked(openTripPicker).mockReset();
    useAuthStore.setState({
      trips: [japan, peru],
      tripId: "japan",
      canCreateTrips: false,
    });
  });

  it("is a link home with one trip and nothing to create", () => {
    useAuthStore.setState({ trips: [japan] });
    render(<TripSwitcher />);
    expect(screen.getByRole("link", { name: "Japan" })).toBeInTheDocument();
  });

  it("lists each trip with its dates and setup, and opens another", async () => {
    render(<TripSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Japan" }));
    const rows = await screen.findAllByRole("menuitem");
    expect(rows[0]).toHaveTextContent("Japan");
    expect(rows[0]).toHaveTextContent("Dec 15, 2026");
    expect(rows[0]).not.toHaveTextContent("Not set up yet");
    expect(rows[1]).toHaveTextContent("Peru");
    expect(rows[1]).toHaveTextContent("Not set up yet");
    expect(
      screen.queryByRole("menuitem", { name: "New itinerary" }),
    ).toBeNull();
    await userEvent.click(rows[1]);
    expect(openTrip).toHaveBeenCalledWith("peru");
  });

  it("goes back to all itineraries", async () => {
    render(<TripSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Japan" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "All itineraries" }),
    );
    expect(openTripPicker).toHaveBeenCalled();
    expect(openTrip).not.toHaveBeenCalled();
  });

  it("offers a new itinerary to a creator, even with one trip", async () => {
    useAuthStore.setState({ trips: [japan], canCreateTrips: true });
    render(<TripSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Japan" }));
    expect(
      await screen.findByRole("menuitem", { name: "New itinerary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "All itineraries" }),
    ).toBeInTheDocument();
  });
});
