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
  it("links the to-dos in the app and the phrasebook as a static page", () => {
    render(<MiscScreen />);
    expect(screen.getByRole("link", { name: /To-dos/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/todos\/?$/),
    );
    // A plain link with no trip: the page isn't a Next route.
    expect(screen.getByRole("link", { name: /Phrasebook/ })).toHaveAttribute(
      "href",
      "/phrasebook/",
    );
  });

  it("shows a read-only link only the phrasebook", () => {
    useViewerStore.setState({ status: "active", share: null });
    render(<MiscScreen />);
    expect(screen.queryByRole("link", { name: /To-dos/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Phrasebook/ })).toBeVisible();
  });
});
