import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PhrasebookScreen } from "@/components/phrasebook-screen";

vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

// What the guide posts while it shows a phrase to staff.
function post(
  data: unknown,
  {
    origin = window.location.origin,
    source,
  }: { origin?: string; source?: MessageEventSource | null } = {},
) {
  const frame = screen.getByTitle("Japanese phrasebook") as HTMLIFrameElement;
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data,
        origin,
        source: source === undefined ? frame.contentWindow : source,
      }),
    );
  });
}

const OPEN = { type: "trip-planner:phrasebook-fullscreen", open: true };
const CLOSED = { type: "trip-planner:phrasebook-fullscreen", open: false };

describe("PhrasebookScreen", () => {
  it("shows the static guide inside the app's frame", () => {
    render(<PhrasebookScreen />);
    const frame = screen.getByTitle("Japanese phrasebook");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("src", "/phrasebook-guide/");
  });

  // Phones: header (3.5rem) and tab bar (4rem plus the safe area) are left
  // out; from md there is no tab bar.
  it("fills the space between the header and the tab bar", () => {
    const { container } = render(<PhrasebookScreen />);
    expect(container.firstElementChild).toHaveClass(
      "h-[calc(100svh-3.5rem-4rem-env(safe-area-inset-bottom))]",
      "md:h-[calc(100svh-3.5rem)]",
    );
  });

  it("covers the whole screen while the guide shows a phrase to staff", () => {
    const { container } = render(<PhrasebookScreen />);
    const main = container.firstElementChild;
    const frame = screen.getByTitle("Japanese phrasebook");
    post(OPEN);
    expect(main).toHaveClass("fixed", "inset-0", "z-50");
    expect(main).toHaveClass("pt-[env(safe-area-inset-top)]");
    expect(main).not.toHaveClass("md:h-[calc(100svh-3.5rem)]");
    // The same frame, so the guide keeps its place.
    expect(screen.getByTitle("Japanese phrasebook")).toBe(frame);
    // The Kanji and Numbers buttons hide together.
    expect(
      screen.getByRole("button", { name: /Numbers, prices and times/ })
        .parentElement,
    ).toHaveClass("hidden");

    post(CLOSED);
    expect(main).not.toHaveClass("fixed");
    expect(main).toHaveClass("md:h-[calc(100svh-3.5rem)]");
    expect(
      screen.getByRole("button", { name: /Numbers, prices and times/ })
        .parentElement,
    ).not.toHaveClass("hidden");
  });

  it("listens only to its own frame on its own site", () => {
    const { container } = render(<PhrasebookScreen />);
    const main = container.firstElementChild;
    post(OPEN, { origin: "https://example.com" });
    post(OPEN, { source: window });
    post(OPEN, { source: null });
    post({ type: "something-else", open: true });
    post("trip-planner:phrasebook-fullscreen");
    expect(main).not.toHaveClass("fixed");
  });

  it("opens the number helper from its button", async () => {
    render(<PhrasebookScreen />);
    act(() => {
      screen
        .getByRole("button", { name: "Numbers, prices and times in Japanese" })
        .click();
    });
    expect(
      await screen.findByRole("dialog", { name: "Numbers in Japanese" }),
    ).toBeInTheDocument();
  });
});
