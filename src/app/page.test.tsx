import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

// The trip-plan badge reads ?trip= via useSearchParams, which needs the
// Next.js router. Tests have no router, so give it an empty query.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("Home", () => {
  it("shows the placeholder trip card", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /japan trip 2026–27/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dec 15, 2026 – Jan 12, 2027")).toBeInTheDocument();
  });
});
