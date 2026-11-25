import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MiscScreen } from "@/components/misc-screen";
import { useViewerStore } from "@/lib/viewer-store";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/misc/",
}));

afterEach(() => useViewerStore.setState({ status: "off", share: null }));

describe("MiscScreen", () => {
  it("links the to-dos and the phrasebook as pages of the app", () => {
    render(<MiscScreen />);
    expect(screen.getByRole("link", { name: /To-dos/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/todos\/?$/),
    );
    expect(screen.getByRole("link", { name: /Phrasebook/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/phrasebook\/?$/),
    );
  });

  it("links the food guide", () => {
    render(<MiscScreen />);
    expect(screen.getByRole("link", { name: /Food/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/food\/?$/),
    );
  });

  it("shows a read-only link only the phrasebook", () => {
    useViewerStore.setState({ status: "active", share: null });
    render(<MiscScreen />);
    expect(screen.queryByRole("link", { name: /To-dos/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Food/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Phrasebook/ })).toBeVisible();
  });
});
