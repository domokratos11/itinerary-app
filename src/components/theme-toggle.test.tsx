import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "./theme-toggle";

const setTheme = vi.fn();
let theme = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme, setTheme }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => setTheme.mockClear());

  it("switches Light to Dark", () => {
    theme = "light";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /Switch to Dark/ }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("switches Dark to Light", () => {
    theme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /Switch to Light/ }));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("treats the old Match phone choice as Light", () => {
    theme = "system";
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /Switch to Dark/ })).toBeTruthy();
  });
});
