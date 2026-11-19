import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KanjiScreen } from "@/components/kanji-screen";

let wide = false;
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => wide }));

describe("KanjiScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    wide = false;
  });

  it("shows the first topic's twenty kanji", () => {
    render(<KanjiScreen />);
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    expect(
      screen.getByRole("button", { name: /^円: yen; circle/ }),
    ).toBeInTheDocument();
  });

  it("opens a kanji with its readings and example", () => {
    render(<KanjiScreen />);
    fireEvent.click(screen.getByRole("button", { name: /^円: yen/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("千円")).toBeInTheDocument();
    expect(within(dialog).getByText("en")).toBeInTheDocument();
    expect(within(dialog).getByText("Where you'll see it")).toBeVisible();
  });

  it("searches every topic", () => {
    render(<KanjiScreen />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "platform" },
    });
    expect(screen.getByRole("button", { name: /^番:/ })).toBeInTheDocument();
  });

  it("remembers the chosen size and uses fewer columns for it", () => {
    render(<KanjiScreen />);
    fireEvent.click(screen.getByRole("radio", { name: "Extra large" }));
    expect(localStorage.getItem("kanji-size")).toBe("xl");
    expect(screen.getAllByRole("list")[0].className).toContain("grid-cols-1");
  });

  it("lists the topics on the side on desktop and marks the current one", () => {
    wide = true;
    render(<KanjiScreen />);
    const topics = screen.getByRole("navigation", { name: "Topic" });
    const hotel = within(topics).getByRole("button", { name: "Hotel" });
    fireEvent.click(hotel);
    expect(hotel).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /^湯:/ })).toBeInTheDocument();
  });
});
