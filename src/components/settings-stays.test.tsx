import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StaysSettings } from "@/components/settings-stays";
import type { StayRecord } from "@/domain/schemas";
import { saveRecord } from "@/lib/trip-actions";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

const service = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  suggestPlaces: vi.fn(),
  locatePlace: vi.fn(),
}));
vi.mock("@/lib/maps-service-instance", () => ({ mapsService: service }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/trip-actions", () => ({
  saveRecord: vi.fn(() => Promise.resolve()),
  archiveRecord: vi.fn(() => Promise.resolve()),
}));

const unlocated: StayRecord = {
  ...fixtureTrip.stays[0],
  hotelName: "Sample Hotel",
  hotelMapsUrl: null,
  lat: null,
  lng: null,
  googlePlaceId: null,
  locationFetchedAt: null,
  locationSource: null,
};

function saved(): StayRecord {
  const calls = vi.mocked(saveRecord).mock.calls as unknown[][];
  return calls.at(-1)?.[2] as StayRecord;
}

function edit(stay: StayRecord) {
  useTripStore.setState({ data: { ...fixtureTrip, stays: [stay] } });
  render(<StaysSettings tripId="trip-1" />);
  fireEvent.click(
    screen.getByRole("button", { name: `Edit stay at ${stay.hotelName}` }),
  );
}

describe("a hotel's place on the map", () => {
  beforeEach(() => {
    vi.mocked(saveRecord).mockClear();
    service.suggestPlaces
      .mockReset()
      .mockResolvedValue([
        { placeId: "g1", name: "Sample Hotel Ueno", detail: "Tokyo" },
      ]);
    service.locatePlace
      .mockReset()
      .mockResolvedValue({ placeId: "g1", lat: 35.7, lng: 139.7 });
  });

  it("says when a hotel has no location yet", () => {
    useTripStore.setState({ data: { ...fixtureTrip, stays: [unlocated] } });
    render(<StaysSettings tripId="trip-1" />);
    expect(screen.getByText("Not on the map yet")).toBeInTheDocument();
  });

  it("saves the exact place chosen from Google's suggestions", async () => {
    edit(unlocated);
    fireEvent.click(
      await screen.findByRole("button", { name: /Sample Hotel Ueno/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveRecord).toHaveBeenCalled());
    expect(saved()).toMatchObject({
      hotelName: "Sample Hotel Ueno",
      googlePlaceId: "g1",
      lat: 35.7,
      lng: 139.7,
      locationSource: "google",
    });
    expect(saved().locationFetchedAt).not.toBeNull();
  });

  it("keeps the place ID when Google can't give coordinates now", async () => {
    const { MapsError } = await import("@/domain/maps-service");
    service.locatePlace.mockRejectedValue(new MapsError("offline"));
    edit(unlocated);
    fireEvent.click(
      await screen.findByRole("button", { name: /Sample Hotel Ueno/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveRecord).toHaveBeenCalled());
    expect(saved()).toMatchObject({ googlePlaceId: "g1", lat: null });
  });

  it("drops the old location when the hotel is renamed by hand", () => {
    edit({ ...unlocated, lat: 35, lng: 139, locationSource: "manual" });
    fireEvent.change(screen.getByLabelText("Hotel"), {
      target: { value: "Another Hotel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(saved()).toMatchObject({ lat: null, lng: null });
  });

  it("keeps the location when only the dates change", () => {
    edit({ ...unlocated, lat: 35, lng: 139, locationSource: "manual" });
    expect(service.suggestPlaces).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(saved()).toMatchObject({ lat: 35, lng: 139 });
  });

  it("doesn't look up a hotel still to be decided", async () => {
    edit({ ...unlocated, hotelName: "To be decided" });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(service.suggestPlaces).not.toHaveBeenCalled();
  });
});
