import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { PalettePicker } from "./palette-picker";
import { setPalette } from "@/lib/palette";

describe("PalettePicker", () => {
  beforeEach(() => {
    localStorage.clear();
    setPalette("sen");
  });

  it("offers the four families", () => {
    render(<PalettePicker />);
    for (const name of ["Sen", "Ink", "Pine", "Plum"])
      expect(screen.getByRole("radio", { name })).toBeTruthy();
  });

  it("saves the chosen family and puts it on the page", () => {
    render(<PalettePicker />);
    fireEvent.click(screen.getByRole("radio", { name: "Plum" }));
    expect(document.documentElement.dataset.palette).toBe("plum");
    expect(localStorage.getItem("palette")).toBe("plum");
    expect(
      screen.getByRole("radio", { name: "Plum" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("keeps one chosen when the chosen one is clicked again", () => {
    render(<PalettePicker />);
    fireEvent.click(screen.getByRole("radio", { name: "Pine" }));
    fireEvent.click(screen.getByRole("radio", { name: "Pine" }));
    expect(localStorage.getItem("palette")).toBe("pine");
  });

  it("is two by two on a phone and one row from lg", () => {
    render(<PalettePicker />);
    const group = screen.getByRole("radiogroup", { name: "Colour theme" });
    expect(group.className).toContain("grid-cols-2");
    expect(group.className).toContain("lg:grid-cols-4");
  });
});
