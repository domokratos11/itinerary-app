import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhrasebookScreen } from "@/components/phrasebook-screen";

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
});
