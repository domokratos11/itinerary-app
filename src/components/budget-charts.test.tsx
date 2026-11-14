import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DailySpendCard, TargetsVsSpentCard } from "@/components/budget-charts";
import { totalsByCategory } from "@/domain/budget";
import { tripDays } from "@/domain/trip";
import { ExpenseRecordSchema } from "@/domain/schemas";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

const expense = (over: Record<string, unknown>) =>
  ExpenseRecordSchema.parse({
    id: "e1",
    title: "Lunch",
    amountJPY: 1000,
    category: "food",
    date: "2026-12-16",
    status: "paid",
    paidBy: "ana@example.com",
    note: null,
    archived: false,
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...over,
  });

const budget = {
  totalJPY: 100000,
  byCategory: { food: 30000, transport: 90000 },
  travellers: null,
  byMember: {},
};

describe("TargetsVsSpentCard", () => {
  it("adds up the targets next to the budget and what was spent", () => {
    const categories = totalsByCategory(
      [
        expense({ amountJPY: 4000 }),
        expense({ id: "e2", amountJPY: 2500, category: "souvenirs" }),
      ],
      budget,
    );
    render(<TargetsVsSpentCard categories={categories} budget={100000} />);
    expect(screen.getByText("All targets")).toBeInTheDocument();
    expect(screen.getByText("¥120,000")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The targets add up to ¥20,000 more than the overall budget.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("¥2,500 spent in categories without a target."),
    ).toBeInTheDocument();
  });

  it("says when there's no budget to compare with", () => {
    render(
      <TargetsVsSpentCard
        categories={totalsByCategory([], null)}
        budget={null}
      />,
    );
    expect(
      screen.getByText("No targets set and nothing paid yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No overall budget is set to compare the targets with."),
    ).toBeInTheDocument();
  });
});

describe("DailySpendCard", () => {
  beforeEach(() => {
    useTripStore.setState({ data: { ...fixtureTrip } });
  });

  it("leaves bookings and flights out of the days", () => {
    const first = tripDays(fixtureTrip)[0].date;
    render(
      <DailySpendCard
        expenses={[
          expense({ amountJPY: 90000, category: "flight", date: first }),
          expense({
            id: "e2",
            amountJPY: 40000,
            category: "booking",
            date: first,
          }),
        ]}
      />,
    );
    expect(
      screen.getByText("Nothing paid on a trip day yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Day-to-day spending only: hotels, reservations and flights are left out.",
      ),
    ).toBeInTheDocument();
  });

  it("totals each category over the trip days and keeps other days apart", () => {
    const first = tripDays(fixtureTrip)[0].date;
    render(
      <DailySpendCard
        expenses={[
          expense({ amountJPY: 1200, date: first }),
          expense({ id: "e2", amountJPY: 800, date: first }),
          expense({
            id: "e3",
            amountJPY: 9000,
            category: "flight",
            date: first,
          }),
          expense({
            id: "e4",
            amountJPY: 3000,
            category: "transport",
            date: "2026-10-01",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("¥2,000")).toBeInTheDocument();
    expect(screen.queryByText("Flights")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "¥3,000 of day-to-day spending was paid outside the trip's days.",
      ),
    ).toBeInTheDocument();
  });
});
