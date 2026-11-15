import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SetupWizard } from "@/components/setup-wizard";
import type { TripSummary } from "@/domain/trip-repository";
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
vi.mock("@/lib/plan-repository-instance", async () => {
  const { LocalPlanRepository } = await import("@/lib/local-plan-repository");
  return { planRepository: new LocalPlanRepository() };
});
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: { isConfigured: () => false },
}));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("@/lib/trip-id", () => ({ openTripPicker: vi.fn() }));

const EMAIL = "ana@example.com";
let trips: LocalTripRepository;
let stop: (() => void)[] = [];

// A new trip in the in-memory repository, fed to the stores the way the
// app's listeners do.
async function newTrip(dates?: { startDate: string; endDate: string }) {
  trips = new LocalTripRepository();
  repository.current = trips;
  const id = await trips.createTrip("Kyoto", EMAIL, { dates });
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
  return id;
}

function summary(id: string): TripSummary {
  const trip = useAuthStore.getState().trips?.find((t) => t.id === id);
  if (!trip) throw new Error("No trip");
  return trip;
}

function renderWizard(id: string) {
  const onDone = vi.fn();
  render(<SetupWizard tripId={id} trip={summary(id)} onDone={onDone} />);
  return onDone;
}

const heading = (name: string) => screen.findByRole("heading", { name });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const input = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement;

describe("SetupWizard", () => {
  beforeEach(() => {
    useTripStore.getState().reset();
    usePlanStore.setState({ items: [] });
  });
  afterEach(() => {
    stop.forEach((s) => s());
    stop = [];
    vi.restoreAllMocks();
    useAuthStore.setState({ tripId: null, trips: null, user: null });
  });

  it("asks for both dates, the end on or after the start", async () => {
    const id = await newTrip();
    const update = vi.spyOn(trips, "updateTrip");
    renderWizard(id);
    expect(input("Name").value).toBe("Kyoto");
    fireEvent.change(input("Start date"), { target: { value: "2027-03-10" } });
    fireEvent.change(input("End date"), { target: { value: "2027-03-05" } });
    expect(screen.getByRole("alert").textContent).toBe(
      "The end date can't be before the start date.",
    );
    fireEvent.click(button("Next"));
    fireEvent.change(input("End date"), { target: { value: "" } });
    fireEvent.click(button("Next"));
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose both a start and an end date.",
    );
    expect(update).not.toHaveBeenCalled();
    // The first step can't be skipped.
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  });

  it("saves the name and dates, then adds a city", async () => {
    const id = await newTrip();
    const update = vi.spyOn(trips, "updateTrip");
    renderWizard(id);
    fireEvent.change(input("Name"), { target: { value: "Kyoto in spring" } });
    fireEvent.change(input("Start date"), { target: { value: "2027-03-01" } });
    fireEvent.change(input("End date"), { target: { value: "2027-03-10" } });
    fireEvent.click(button("Next"));
    await heading("Cities");
    expect(update).toHaveBeenCalledWith(id, {
      name: "Kyoto in spring",
      startDate: "2027-03-01",
      endDate: "2027-03-10",
    });
    expect(screen.getByText("No cities yet.")).toBeInTheDocument();

    fireEvent.click(button("Add city"));
    const dialog = await screen.findByRole("dialog", { name: "Add city" });
    fireEvent.change(input("Name"), { target: { value: "Kyoto" } });
    fireEvent.click(button("Save"));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(useTripStore.getState().data.cities.map((c) => c.name)).toEqual([
      "Kyoto",
    ]);
    expect(screen.getByText("Kyoto", { selector: "span" })).toBeTruthy();
    // With something in it the step moves on with Next, not Skip.
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    fireEvent.click(button("Next"));
    await heading("Hotels");
  });

  it("skips to the summary, which lists what was skipped and opens the itinerary", async () => {
    const id = await newTrip({
      startDate: "2027-03-01",
      endDate: "2027-03-10",
    });
    const update = vi.spyOn(trips, "updateTrip");
    const onDone = renderWizard(id);
    await heading("Cities");
    fireEvent.click(button("Skip"));
    await heading("Hotels");
    expect(
      screen.getByText(/Each hotel belongs to a city/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add stay" })).toBeNull();
    fireEvent.click(button("Skip"));
    await heading("Flights");
    fireEvent.click(button("Skip"));
    await heading("Travellers and budget");
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    fireEvent.click(button("Skip"));
    await heading("Summary");
    expect(screen.getAllByText("Skipped")).toHaveLength(4);
    fireEvent.click(button("Back"));
    await heading("Travellers and budget");
    fireEvent.click(button("Skip"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Open itinerary" }),
    );
    expect(update).toHaveBeenCalledWith(id, { setup: "done" });
    expect(onDone).toHaveBeenCalled();
    await waitFor(() => expect(summary(id).setup).toBe("done"));
  });

  it("finishes later from any step", async () => {
    const id = await newTrip();
    const onDone = renderWizard(id);
    fireEvent.click(button("Finish later"));
    expect(onDone).toHaveBeenCalled();
    await waitFor(() => expect(summary(id).setup).toBe("done"));
  });

  it("resumes at the first step with nothing in it", async () => {
    const id = await newTrip({
      startDate: "2027-03-01",
      endDate: "2027-03-10",
    });
    await trips.saveMany(id, "cities", fixtureTrip.cities);
    renderWizard(id);
    await heading("Hotels");
  });

  it("starts a new hotel on the trip's dates", async () => {
    const id = await newTrip({
      startDate: "2027-03-01",
      endDate: "2027-03-10",
    });
    await trips.saveMany(id, "cities", fixtureTrip.cities);
    renderWizard(id);
    await heading("Hotels");
    fireEvent.click(button("Add stay"));
    await screen.findByRole("dialog", { name: "Add stay" });
    expect(input("Check-in").value).toBe("2027-03-01");
    expect(input("Check-out").value).toBe("2027-03-10");
  });

  it("offers Start from only with another itinerary to copy from", async () => {
    const id = await newTrip({
      startDate: "2027-03-01",
      endDate: "2027-03-10",
    });
    const { unmount } = render(
      <SetupWizard tripId={id} trip={summary(id)} onDone={vi.fn()} />,
    );
    const steps = () => screen.getByRole("navigation", { name: "Setup steps" });
    await heading("Cities");
    expect(
      within(steps()).queryByRole("button", { name: /Start from/ }),
    ).toBeNull();
    unmount();

    const other = await trips.createTrip("Japan", EMAIL);
    await trips.saveMany(other, "cities", fixtureTrip.cities);
    renderWizard(id);
    await heading("Start from");
    expect(
      within(steps()).getByRole("button", { name: /Start from/ }),
    ).toBeInTheDocument();
  });

  it("copies from another itinerary, moves on and sums it up", async () => {
    const id = await newTrip({
      startDate: "2027-03-01",
      endDate: "2027-03-10",
    });
    const other = await trips.createTrip("Japan", EMAIL);
    await trips.saveMany(other, "cities", fixtureTrip.cities);
    renderWizard(id);
    await heading("Start from");
    fireEvent.click(button(/Copy from another itinerary/));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Cities" }));
    fireEvent.click(button("Copy"));
    await heading("Cities");
    expect(useTripStore.getState().data.cities.map((c) => c.id)).toEqual([
      "tokyo-ueno",
      "nagoya",
    ]);
    // The source keeps its own cities as they were.
    expect((await trips.readTrip(other)).cities).toEqual(fixtureTrip.cities);
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Setup steps" })).getByRole(
        "button",
        { name: /Summary/ },
      ),
    );
    await heading("Summary");
    expect(screen.getByText("From Japan: 2 cities")).toBeInTheDocument();
  });

  it("says when it is offline and still lets you finish later", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const id = await newTrip();
    const onDone = renderWizard(id);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.queryByLabelText("Start date")).toBeNull();
    fireEvent.click(button("Finish later"));
    expect(onDone).toHaveBeenCalled();
  });
});
