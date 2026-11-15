import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TripSettings } from "@/components/settings-trip";
import { useAuthStore } from "@/lib/auth-store";
import { LocalTripRepository } from "@/lib/local-trip-repository";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

const repository = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/trip-repository-instance", () => ({
  get tripRepository() {
    return repository.current;
  },
}));
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: { isConfigured: () => false },
}));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));

let trips: LocalTripRepository;

async function openTrip(dates?: { startDate: string; endDate: string }) {
  trips = new LocalTripRepository();
  repository.current = trips;
  const id = await trips.createTrip("Japan", "ana@example.com", { dates });
  trips.watchMyTrips("ana@example.com", (list) =>
    useAuthStore.setState({ trips: list }),
  );
  useAuthStore.setState({ tripId: id });
  return id;
}

function field(name: string) {
  return screen.getByLabelText(name) as HTMLInputElement;
}

describe("Settings → Trip dates", () => {
  beforeEach(() => {
    useTripStore.setState({ data: fixtureTrip });
    usePlanStore.setState({
      items: [
        {
          id: "i1",
          placeId: "p1",
          date: "2026-12-28",
          order: "a0",
          status: "planned",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });
  });
  afterEach(() => useAuthStore.setState({ tripId: null, trips: null }));

  it("saves new dates and shows the days they add", async () => {
    const id = await openTrip();
    const update = vi.spyOn(trips, "updateTrip");
    render(<TripSettings tripId={id} />);
    expect(field("Start date").value).toBe("");
    fireEvent.change(field("Start date"), { target: { value: "2026-12-15" } });
    fireEvent.change(field("End date"), { target: { value: "2026-12-27" } });
    expect(screen.getByText(/Adds/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save dates" }));
    expect(update).toHaveBeenCalledWith(id, {
      startDate: "2026-12-15",
      endDate: "2026-12-27",
    });
  });

  it("refuses an end before the start", async () => {
    const id = await openTrip();
    render(<TripSettings tripId={id} />);
    fireEvent.change(field("Start date"), { target: { value: "2026-12-20" } });
    fireEvent.change(field("End date"), { target: { value: "2026-12-18" } });
    expect(screen.getByRole("alert").textContent).toBe(
      "The end date can't be before the start date.",
    );
    expect(
      (screen.getByRole("button", { name: "Save dates" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("warns when stops would fall outside the new dates", async () => {
    const id = await openTrip({
      startDate: "2026-12-15",
      endDate: "2026-12-29",
    });
    render(<TripSettings tripId={id} />);
    expect(field("Start date").value).toBe("2026-12-15");
    fireEvent.change(field("End date"), { target: { value: "2026-12-27" } });
    expect(screen.getByText("1 stop will need a new day")).toBeTruthy();
  });

  it("clears the dates, with the same warning", async () => {
    const id = await openTrip({
      startDate: "2026-12-15",
      endDate: "2026-12-29",
    });
    const update = vi.spyOn(trips, "updateTrip");
    render(<TripSettings tripId={id} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear dates" }));
    expect(screen.getByText("1 stop will need a new day")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save dates" }));
    expect(update).toHaveBeenCalledWith(id, { startDate: null, endDate: null });
  });
});
