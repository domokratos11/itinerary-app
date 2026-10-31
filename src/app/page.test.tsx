import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";
import Home from "./page";

// The trip-plan badge reads ?trip= via useSearchParams, which needs the
// Next.js router. Tests have no router, so give it an empty query.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("Home", () => {
  it("shows the placeholder trip card", () => {
    useTripStore.setState({ data: fixtureTrip });
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /japan trip 2026–27/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dec 15, 2026 – Dec 27, 2026")).toBeInTheDocument();
  });
});
