import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyItinerary } from "@/components/copy-itinerary";
import { BackupSettings } from "@/components/settings-backup";
import { testPlace } from "@/domain/test-place";
import { TRIP_COLLECTIONS } from "@/domain/trip";
import { useAuthStore } from "@/lib/auth-store";
import { LocalPlanRepository } from "@/lib/local-plan-repository";
import { LocalTripRepository } from "@/lib/local-trip-repository";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";
import { useViewerStore } from "@/lib/viewer-store";
import { fixtureTrip } from "@/test/fixture-trip";

const repositories = vi.hoisted(() => ({
  trips: null as unknown,
  plans: null as unknown,
}));
vi.mock("@/lib/trip-repository-instance", () => ({
  get tripRepository() {
    return repositories.trips;
  },
}));
vi.mock("@/lib/plan-repository-instance", () => ({
  get planRepository() {
    return repositories.plans;
  },
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("@/lib/use-proposals", () => ({ useProposals: () => [] }));
vi.mock("@/lib/use-day-research", () => ({ useDayResearch: () => [] }));

const EMAIL = "ana@example.com";
let trips: LocalTripRepository;
let plans: LocalPlanRepository;
let stop: (() => void)[] = [];

// The sample trip as "Japan" (no dates of its own, like the real one) and
// an empty "Kyoto" from Mar 1 to Mar 5, which is open.
async function setUp({ withSource = true } = {}) {
  trips = new LocalTripRepository();
  plans = new LocalPlanRepository();
  repositories.trips = trips;
  repositories.plans = plans;
  let sourceId: string | null = null;
  if (withSource) {
    sourceId = await trips.createTrip("Japan", EMAIL);
    await trips.updateTrip(sourceId, { setup: "done" });
    for (const name of TRIP_COLLECTIONS)
      if (fixtureTrip[name].length)
        await trips.saveMany(sourceId, name, fixtureTrip[name]);
    await trips.save(
      sourceId,
      "places",
      testPlace({ id: "castle", cityId: "nagoya", name: "Nagoya Castle" }),
    );
    await plans.save(sourceId, {
      id: "stop-1",
      placeId: "castle",
      date: "2026-12-25",
      order: "a0",
      status: "planned",
      updatedAt: "2026-10-29T00:00:00.000Z",
    });
  }
  const id = await trips.createTrip("Kyoto", EMAIL, {
    dates: { startDate: "2027-03-01", endDate: "2027-03-05" },
  });
  stop.push(
    trips.watchMyTrips(EMAIL, (list) => useAuthStore.setState({ trips: list })),
    trips.subscribe(id, (collection, records) =>
      useTripStore.getState().setCollection(collection, records),
    ),
  );
  useAuthStore.setState({
    tripId: id,
    user: { uid: "u1", email: EMAIL, name: "Ana" },
  });
  return { id, sourceId };
}

const box = (name: string) =>
  screen.getByRole("checkbox", { name }) as HTMLButtonElement;
const checked = (name: string) => box(name).getAttribute("aria-checked");

describe("CopyItinerary", () => {
  beforeEach(() => {
    useTripStore.getState().reset();
    usePlanStore.setState({ items: [] });
  });
  afterEach(() => {
    stop.forEach((s) => s());
    stop = [];
    vi.restoreAllMocks();
    useAuthStore.setState({ tripId: null, trips: null, user: null });
    useViewerStore.setState({ status: "off", share: null });
  });

  it("ticks what a choice needs, previews it and copies", async () => {
    const { id, sourceId } = await setUp();
    render(<CopyItinerary tripId={id} trigger="button" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Choose what to copy" }),
    );
    // The only other itinerary is picked and read at once.
    await screen.findByRole("checkbox", { name: "Cities" });
    expect(
      screen.getByRole("button", { name: /Japan/, pressed: true }),
    ).toBeInTheDocument();
    // The dates move, so the holidays aren't offered; nothing else is
    // offered without something to copy.
    expect(screen.queryByRole("checkbox", { name: "Holidays" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Flights" })).toBeNull();
    expect(
      screen.getByText("Choose at least one thing to copy."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();

    fireEvent.click(box("Day plan"));
    expect(checked("Cities")).toBe("true");
    expect(checked("Places")).toBe("true");
    fireEvent.click(box("Cities"));
    expect(checked("Places")).toBe("false");
    expect(checked("Day plan")).toBe("false");

    fireEvent.click(box("Hotels"));
    expect(checked("Cities")).toBe("true");
    expect(screen.getByText(/Every date moves 74 days later/)).toBeVisible();
    // Nagoya's hotel starts after the new last day.
    expect(screen.getByText("Outside the new dates")).toBeVisible();
    expect(screen.getByText(/Sample Hotel Nagoya/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(useTripStore.getState().data.stays).toHaveLength(2),
    );
    expect(useTripStore.getState().data.stays.map((s) => s.checkIn)).toEqual([
      "2027-03-01",
      "2027-03-08",
    ]);
    expect(useTripStore.getState().data.places).toEqual([]);
    // The source is only read.
    expect((await trips.readTrip(sourceId!)).stays).toEqual(fixtureTrip.stays);
  });

  it("can't copy while offline", async () => {
    const { id } = await setUp();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<CopyItinerary tripId={id} trigger="button" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Choose what to copy" }),
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: "Cities" }));
    expect(screen.getByText("Copying needs a connection.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
  });
});

describe("Settings → Backup", () => {
  afterEach(() => {
    stop.forEach((s) => s());
    stop = [];
    useAuthStore.setState({ tripId: null, trips: null, user: null });
    useViewerStore.setState({ status: "off", share: null });
  });

  const heading = () =>
    screen.queryByRole("heading", { name: "Copy from another itinerary" });

  it("offers the copy only while the trip is empty", async () => {
    useTripStore.getState().reset();
    const { id } = await setUp();
    const { unmount } = render(<BackupSettings tripId={id} />);
    expect(heading()).toBeInTheDocument();
    unmount();

    await trips.save(id, "cities", fixtureTrip.cities[0]);
    render(<BackupSettings tripId={id} />);
    expect(heading()).toBeNull();
  });

  it("doesn't offer it without another itinerary or on a read-only link", async () => {
    useTripStore.getState().reset();
    const { id } = await setUp({ withSource: false });
    const { unmount } = render(<BackupSettings tripId={id} />);
    expect(heading()).toBeNull();
    unmount();
    stop.forEach((s) => s());
    stop = [];

    useTripStore.getState().reset();
    const other = await setUp();
    useViewerStore.setState({ status: "active" });
    render(<BackupSettings tripId={other.id} />);
    expect(heading()).toBeNull();
  });
});
