import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/auth-store";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";
import Home from "./page";

// The trip-plan badge reads ?trip= via useSearchParams, which needs the
// Next.js router. Tests have no router, so give it an empty query.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("Home", () => {
  it("shows the open trip's name and dates", () => {
    useTripStore.setState({ data: fixtureTrip });
    useAuthStore.setState({
      tripId: "trip-1",
      trips: [{ id: "trip-1", name: "Peru 2027", members: [] }],
    });
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Peru 2027" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dec 15, 2026 – Dec 27, 2026")).toBeInTheDocument();
  });
});
