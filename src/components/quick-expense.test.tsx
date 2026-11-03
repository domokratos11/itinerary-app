import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuickExpenseButton } from "@/components/quick-expense";
import { useAuthStore } from "@/lib/auth-store";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

const saveRecord = vi.fn(async () => {});
vi.mock("@/lib/trip-actions", () => ({
  saveRecord: (...args: unknown[]) => saveRecord(...(args as [])),
  archiveRecord: vi.fn(async () => {}),
}));
vi.mock("@/lib/use-trip-id", () => ({ useTripId: () => "trip" }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));

describe("QuickExpenseButton", () => {
  beforeEach(() => {
    saveRecord.mockClear();
    localStorage.clear();
    useTripStore.setState({ data: fixtureTrip });
    useAuthStore.setState({
      user: { uid: "u1", email: "Ana@example.com", name: "Ana" },
    });
  });

  it("logs a cost with the amount and one tap on a category", async () => {
    render(<QuickExpenseButton date="2026-12-18" />);
    fireEvent.click(screen.getByRole("button", { name: "Log a cost" }));
    fireEvent.change(screen.getByLabelText("Amount (¥)"), {
      target: { value: "480" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Transport/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(saveRecord).toHaveBeenCalledWith(
      "trip",
      "expenses",
      expect.objectContaining({
        amountJPY: 480,
        category: "transport",
        title: "Transport",
        date: "2026-12-18",
        cityId: "tokyo-ueno",
        paidBy: "ana@example.com",
      }),
      expect.any(String),
    );
    expect(localStorage.getItem("quick-expense-category")).toBe("transport");
  });

  it("can't be saved without an amount", () => {
    render(<QuickExpenseButton date="2026-12-18" />);
    fireEvent.click(screen.getByRole("button", { name: "Log a cost" }));
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
