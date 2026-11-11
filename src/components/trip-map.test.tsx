import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TripMap } from "@/components/trip-map";

const view = { update: vi.fn(), focus: vi.fn(), fit: vi.fn(), destroy: vi.fn() };
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: {
    isConfigured: () => true,
    createMap: () => Promise.resolve(view),
  },
}));

const pin = {
  id: "zoo",
  position: { lat: 35.7, lng: 139.7 },
  title: "Ueno Zoo",
  label: "1",
  color: "#000000",
  emphasised: false,
  clickable: true,
};

describe("TripMap full screen", () => {
  it("grows over the page and closes with Escape or its button", async () => {
    render(<TripMap pins={[pin]} toolbar={<span>tools</span>} />);
    await act(() => Promise.resolve());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("tools")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Full screen map" }));
    const dialog = screen.getByRole("dialog", { name: "Full screen map" });
    expect(dialog).toHaveClass("fixed", "inset-0");
    expect(document.body.style.overflow).toBe("hidden");
    // The controls stay usable in full screen.
    expect(screen.getByText("tools")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Full screen map" }));
    fireEvent.click(screen.getByRole("button", { name: "Close full screen" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
