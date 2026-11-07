import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PageError from "./error";

describe("PageError", () => {
  it("offers a retry and a way back to the dashboard", () => {
    const retry = vi.fn();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PageError error={new Error("boom")} retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Go to Dashboard" }),
    ).toHaveAttribute("href", "/");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
