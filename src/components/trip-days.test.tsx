import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TripDays } from "@/components/trip-days";
import { EMPTY_TRIP } from "@/domain/trip";
import { useAuthStore } from "@/lib/auth-store";
import { LocalShareRepository } from "@/lib/local-share-repository";
import { usePlanStore } from "@/lib/plan-store";
import { useViewerStore } from "@/lib/viewer-store";
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

describe("TripDays of a trip with dates and no hotels", () => {
  beforeEach(() => {
    localStorage.clear();
    useTripStore.setState({ data: { ...EMPTY_TRIP } });
    usePlanStore.setState({ items: [] });
    useAuthStore.setState({
      tripId: "t1",
      trips: [
        {
          id: "t1",
          name: "Spring",
          members: ["ana@example.com"],
          startDate: "2027-03-30",
          endDate: "2027-04-02",
          setup: "pending",
        },
      ],
    });
  });
  afterEach(() => useAuthStore.setState({ tripId: null, trips: null }));

  it("shows a day for every date, saying there is no hotel yet", () => {
    render(<TripDays />);
    const cell = screen.getByRole("cell", { name: /Mar 30.*No hotel yet/ });
    expect(cell.getAttribute("href")).toContain("date=2027-03-30");
    expect(screen.getByRole("cell", { name: /Apr 2/ })).toBeTruthy();
    expect(screen.queryByText(/No stays yet/)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    expect(screen.getByText("No hotel yet")).toBeTruthy();
    expect(screen.queryByText("No hotel booked")).toBeNull();
  });

  it("takes the dates from a read-only link's copy", async () => {
    useAuthStore.setState({ tripId: null, trips: null });
    const links = new LocalShareRepository(
      () => new Date("2026-11-01T00:00:00.000Z"),
    );
    const made = await links.create(
      {
        tripId: "t1",
        tripName: "Spring",
        label: "",
        expiresAt: "2026-11-09T00:00:00.000Z",
        dates: { startDate: "2027-03-30", endDate: "2027-03-31" },
      },
      {
        cities: [],
        stays: [],
        reservations: [],
        places: [],
        holidays: [],
        flights: [],
        items: [],
      },
    );
    const opened = await links.load(made.id);
    if (!opened) throw new Error("The link didn't open");
    useViewerStore.getState().open(opened.share);
    try {
      render(<TripDays />);
      expect(screen.getByRole("cell", { name: /Mar 31/ })).toBeTruthy();
    } finally {
      useViewerStore.setState({ status: "off", share: null });
    }
  });

  it("has no days with neither dates nor hotels", () => {
    useAuthStore.setState({
      trips: [{ id: "t1", name: "Spring", members: ["ana@example.com"] }],
    });
    render(<TripDays />);
    expect(screen.getByText(/No stays yet/)).toBeTruthy();
    expect(screen.queryAllByRole("cell")).toHaveLength(0);
  });
});
