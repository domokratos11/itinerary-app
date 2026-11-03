import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TripDays } from "@/components/trip-days";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

describe("TripDays", () => {
  beforeEach(() => {
    localStorage.clear();
    useTripStore.setState({ data: fixtureTrip });
    usePlanStore.setState({
      items: [
        {
          id: "i1",
          placeId: "p1",
          date: "2026-12-18",
          order: "a0",
          status: "planned",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("shows a Monday-first calendar by default", () => {
    render(<TripDays />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    const cell = screen.getByRole("cell", { name: /Dec 18.*1 stop/ });
    expect(cell.getAttribute("href")).toContain("date=2026-12-18");
    // The first row starts on the Monday before the trip.
    const firstRow = screen.getAllByRole("row")[1];
    expect(within(firstRow).getAllByRole("cell")[0].textContent).toBe("14");
  });

  it("switches to the list and remembers it", () => {
    render(<TripDays />);
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
    expect(screen.getByText("Sample Hotel Tokyo")).toBeTruthy();
    expect(localStorage.getItem("days-view")).toBe("list");
  });
});
