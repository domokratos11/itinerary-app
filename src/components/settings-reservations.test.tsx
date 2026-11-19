import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReservationsSettings } from "@/components/settings-reservations";
import type { ExpenseRecord, ReservationRecord } from "@/domain/schemas";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/trip-actions", () => ({
  saveRecord: vi.fn(() => Promise.resolve()),
  archiveRecord: vi.fn(() => Promise.resolve()),
}));
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
);
vi.mock("sonner", () => ({ toast }));

const train: ReservationRecord = {
  id: "train-2026-12-20",
  type: "train",
  date: "2026-12-20",
  time: "08:10",
  endTime: "10:24",
  from: "Tokyo",
  to: "Kyoto",
  trainName: "Nozomi 21",
  seat: "Car 7, 12A",
  placeId: null,
  venue: null,
  people: null,
  note: null,
  archived: false,
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const museum: ReservationRecord = {
  ...train,
  id: "ticket-2026-12-17",
  type: "ticket",
  date: "2026-12-17",
  time: "09:30",
  endTime: null,
  from: null,
  to: null,
  trainName: null,
  seat: null,
  venue: "Sample Museum",
  people: 2,
};

const cost = (
  id: string,
  fields: Partial<ExpenseRecord> = {},
): ExpenseRecord => ({
  id,
  title: "Train · Tokyo · Kyoto",
  amountJPY: 14000,
  category: "transport",
  date: "2026-12-20",
  status: "paid",
  paidBy: null,
  placeId: null,
  reservationId: train.id,
  stayId: null,
  cityId: null,
  originalUSD: null,
  rateJPYPerUSD: null,
  paymentMethod: "card",
  note: null,
  archived: false,
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...fields,
});

function show(reservations: ReservationRecord[], expenses: ExpenseRecord[]) {
  useTripStore.setState({
    data: { ...fixtureTrip, reservations, expenses },
  });
  render(<ReservationsSettings tripId="trip-1" />);
}

describe("ReservationsSettings", () => {
  beforeEach(() => {
    vi.mocked(saveRecord).mockClear();
    vi.mocked(archiveRecord).mockClear();
    toast.mockClear();
  });

  it("shows a ride's stations, times, train and seat", () => {
    show([train], []);
    expect(screen.getByText("Tokyo → Kyoto")).toBeInTheDocument();
    expect(
      screen.getByText("08:10–10:24 · Nozomi 21 · Car 7, 12A"),
    ).toBeInTheDocument();
  });

  it("archives a booking's costs with it, and Undo brings them back", () => {
    const saved = cost("saved");
    const extra = cost("extra", { title: "Seat upgrade", amountJPY: 900 });
    const other = cost("other", { reservationId: "something-else" });
    show([train], [saved, extra, other]);
    fireEvent.click(
      screen.getByRole("button", { name: "Archive reservation" }),
    );
    const archived = vi
      .mocked(archiveRecord)
      .mock.calls.map((call) => [call[1], (call[2] as { id: string }).id]);
    expect(archived).toEqual([
      ["reservations", train.id],
      ["expenses", "saved"],
      ["expenses", "extra"],
    ]);
    const [message, options] = toast.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    expect(message).toBe(
      "Reservation archived, and its cost taken out of the budget",
    );
    options.action.onClick();
    const restored = vi
      .mocked(saveRecord)
      .mock.calls.map((call) => [call[1], (call[2] as { id: string }).id]);
    expect(restored).toEqual([
      ["reservations", train.id],
      ["expenses", "saved"],
      ["expenses", "extra"],
    ]);
  });

  it("edits an entry with its venue, times and people", () => {
    show([museum], []);
    fireEvent.click(screen.getByRole("button", { name: "Edit reservation" }));
    // An entry has no stations or train.
    expect(screen.queryByLabelText("From")).toBeNull();
    expect(screen.queryByLabelText("Train (optional)")).toBeNull();
    fireEvent.change(screen.getByLabelText("Venue"), {
      target: { value: "Tokyo National Museum" },
    });
    fireEvent.change(screen.getByLabelText("Ends (optional)"), {
      target: { value: "12:00" },
    });
    fireEvent.change(screen.getByLabelText("People (optional)"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const record = vi
      .mocked(saveRecord)
      .mock.calls.find((call) => call[1] === "reservations")?.[2];
    expect(record).toMatchObject({
      type: "ticket",
      venue: "Tokyo National Museum",
      time: "09:30",
      endTime: "12:00",
      people: 3,
      from: null,
      to: null,
      trainName: null,
    });
  });

  it("refuses more than 20 people", () => {
    show([museum], []);
    fireEvent.click(screen.getByRole("button", { name: "Edit reservation" }));
    fireEvent.change(screen.getByLabelText("People (optional)"), {
      target: { value: "21" },
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
