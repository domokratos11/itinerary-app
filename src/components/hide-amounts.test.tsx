import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BudgetScreen } from "@/components/budget-screen";
import { DashboardScreen } from "@/components/dashboard-screen";
import { Yen } from "@/components/yen";
import { HIDDEN_AMOUNT } from "@/domain/budget";
import type { ExpenseRecord } from "@/domain/schemas";
import { testPlace } from "@/domain/test-place";
import { useAuthStore } from "@/lib/auth-store";
import { setHideAmounts, useHideAmounts } from "@/lib/hide-amounts";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/lib/use-proposals", () => ({ useProposals: () => [] }));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));

const expense = (id: string, amountJPY: number, paidBy: string) =>
  ({
    id,
    title: `Expense ${id}`,
    amountJPY,
    category: "food",
    date: "2026-12-18",
    status: "paid",
    paidBy,
    placeId: null,
    reservationId: null,
    stayId: null,
    note: null,
    archived: false,
    updatedAt: "2026-11-01T00:00:00.000Z",
  }) as ExpenseRecord;

// Each amount is written out in full so it can't be mistaken for anything else.
const REAL_AMOUNTS = ["123,456", "76,544", "200,000", "500,000", "300,000"];

function realAmountsShown(): string[] {
  const text = document.body.textContent ?? "";
  return REAL_AMOUNTS.filter((amount) => text.includes(amount));
}

const barValues = () =>
  screen
    .getAllByRole("progressbar")
    .map((bar) => bar.getAttribute("aria-valuenow"));

describe.each<[string, () => ReactNode]>([
  ["Budget", () => <BudgetScreen />],
  ["Dashboard", () => <DashboardScreen />],
])("hiding amounts on %s", (_name, ui) => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-01T00:00:00.000Z"));
    localStorage.clear();
    setHideAmounts(false);
    useTripStore.setState({
      data: {
        ...fixtureTrip,
        places: [testPlace({ cityId: "nagoya" })],
        expenses: [
          expense("a", 123456, "ana@example.com"),
          expense("b", 76544, "ben@example.com"),
        ],
      },
    });
    useAuthStore.setState({
      status: "signed-in",
      user: { uid: "u1", email: "ana@example.com", name: "Ana" },
      tripId: "trip-1",
      access: "member",
      trips: [
        {
          id: "trip-1",
          name: "Peru",
          members: ["ana@example.com", "ben@example.com"],
          budget: {
            totalJPY: 500000,
            byCategory: { food: 200000 },
            travellers: 2,
          },
        },
      ],
    });
  });

  it("shows the amounts until the eye is closed", () => {
    render(ui());
    expect(realAmountsShown()).toContain("200,000");
    expect(screen.queryAllByText(HIDDEN_AMOUNT)).toHaveLength(0);
  });

  it("leaves no real amount on the page while hidden", () => {
    render(ui());
    fireEvent.click(screen.getByRole("button", { name: "Hide amounts" }));
    expect(realAmountsShown()).toEqual([]);
    expect(document.body.textContent).not.toMatch(/¥\d/);
    expect(document.body.textContent).toContain(HIDDEN_AMOUNT);
  });

  it("gives no dollar hint when a hidden amount is tapped", () => {
    setHideAmounts(true);
    render(ui());
    for (const amount of screen.getAllByText(HIDDEN_AMOUNT).slice(0, 5))
      fireEvent.click(amount);
    expect(document.body.textContent).not.toContain("$");
  });

  it("keeps the charts' proportions true", () => {
    render(ui());
    const shown = barValues();
    fireEvent.click(screen.getByRole("button", { name: "Hide amounts" }));
    expect(barValues()).toEqual(shown);
  });

  it("brings the amounts back and remembers the choice", () => {
    render(ui());
    fireEvent.click(screen.getByRole("button", { name: "Hide amounts" }));
    expect(localStorage.getItem("hide-amounts")).toBe("true");
    const eye = screen.getByRole("button", { name: "Show amounts" });
    expect(eye).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(eye);
    expect(useHideAmounts.getState().hidden).toBe(false);
    expect(realAmountsShown()).toContain("200,000");
  });
});

describe("hiding amounts elsewhere", () => {
  it("doesn't touch an amount outside the two screens", () => {
    setHideAmounts(true);
    render(<Yen yen={1500} />);
    expect(screen.getByText("¥1,500")).toBeInTheDocument();
    setHideAmounts(false);
  });
});

describe("the budget's forms while hidden", () => {
  it("wait for the amounts to show", () => {
    setHideAmounts(true);
    render(<BudgetScreen />);
    expect(screen.getByRole("button", { name: "Set budget" })).toBeDisabled();
    for (const edit of screen.getAllByRole("button", {
      name: "Show the amounts to edit this",
    }))
      expect(edit).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add expense" })).toBeEnabled();
    setHideAmounts(false);
  });
});
