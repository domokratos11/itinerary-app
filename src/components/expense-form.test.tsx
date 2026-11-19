import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExpenseForm } from "@/components/expense-form";
import type { ExpenseRecord } from "@/domain/schemas";
import { useAuthStore } from "@/lib/auth-store";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

const saveRecord = vi.fn(async () => {});
vi.mock("@/lib/trip-actions", () => ({
  saveRecord: (...args: unknown[]) => saveRecord(...(args as [])),
  archiveRecord: vi.fn(async () => {}),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("@/lib/tokyo-date", () => ({ todayInTokyo: () => "2026-12-18" }));
vi.mock("@/lib/auth-store", async (original) => ({
  ...(await original<typeof import("@/lib/auth-store")>()),
  useActiveTrip: () => ({ members: ["ana@example.com", "bo@example.com"] }),
}));

function saved(): ExpenseRecord {
  const calls = saveRecord.mock.calls as unknown[][];
  return calls.at(-1)?.[2] as ExpenseRecord;
}

describe("ExpenseForm", () => {
  beforeEach(() => {
    saveRecord.mockClear();
    localStorage.clear();
    useTripStore.setState({ data: fixtureTrip });
    useAuthStore.setState({
      user: { uid: "u1", email: "Bo@example.com", name: "Bo" },
    });
  });

  it("starts a new cost paid by the person signed in, today", async () => {
    render(<ExpenseForm tripId="trip" expense={null} onClose={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "bo" })).toBeChecked();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-12-18");
    fireEvent.change(screen.getByLabelText("Amount (¥)"), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Food/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(saved()).toMatchObject({
      amountJPY: 1200,
      category: "food",
      title: "Food",
      paidBy: "bo@example.com",
      date: "2026-12-18",
      status: "paid",
    });
  });

  it("lets someone else be the payer and plans a future day", async () => {
    render(<ExpenseForm tripId="trip" expense={null} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Amount (¥)"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "ana" }));
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-12-24" },
    });
    expect(screen.getByRole("radio", { name: "Planned" })).toBeChecked();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(saved()).toMatchObject({
      paidBy: "ana@example.com",
      date: "2026-12-24",
      status: "planned",
    });
  });

  it("edits an expense in the same form, keeping its details", async () => {
    const expense: ExpenseRecord = {
      id: "e1",
      title: "Ramen",
      amountJPY: 980,
      category: "food",
      date: "2026-12-17",
      status: "paid",
      paidBy: "ana@example.com",
      placeId: null,
      reservationId: null,
      stayId: null,
      cityId: "tokyo-ueno",
      originalUSD: null,
      rateJPYPerUSD: null,
      paymentMethod: "cash",
      note: "Ichiran",
      archived: false,
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    render(<ExpenseForm tripId="trip" expense={expense} onClose={vi.fn()} />);
    expect(screen.getByText("Edit expense")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "ana" })).toBeChecked();
    expect(screen.getByLabelText("What (optional)")).toHaveValue("Ramen");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("Ichiran");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(saved()).toMatchObject({
      id: "e1",
      title: "Ramen",
      paymentMethod: "cash",
      cityId: "tokyo-ueno",
    });
  });
});
