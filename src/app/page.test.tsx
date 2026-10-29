import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("shows the placeholder trip card", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /japan trip 2026–27/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dec 15, 2026 – Jan 12, 2027")).toBeInTheDocument();
  });
});
