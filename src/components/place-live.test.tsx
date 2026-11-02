import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlaceLive, PlacePhotos } from "@/components/place-live";
import { MapsError } from "@/domain/maps-service";
import { placeRecordDefaults, type PlaceRecord } from "@/domain/schemas";
import { clearLiveCache } from "@/lib/place-live-cache";

const service = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  liveDetails: vi.fn(),
  photos: vi.fn(),
}));
vi.mock("@/lib/maps-service-instance", () => ({ mapsService: service }));

const place = {
  ...placeRecordDefaults(),
  id: "ueno-zoo",
  name: "Ueno Zoo",
  googlePlaceId: "g1",
  openingHours: null,
} as unknown as PlaceRecord;

const answer = {
  openNow: true,
  rating: 4.5,
  ratingCount: 1200,
  todayHours: "9:30 AM – 5:00 PM",
  mapsUrl: null,
};

describe("a place's Google details", () => {
  // The daily count also lives in memory, so each test gets a day of its own.
  let day = 1;

  beforeEach(() => {
    vi.setSystemTime(new Date(Date.UTC(2026, 10, day++, 3)));
    localStorage.clear();
    clearLiveCache();
    service.isConfigured.mockReturnValue(true);
    service.liveDetails.mockReset().mockResolvedValue(answer);
    service.photos.mockReset().mockResolvedValue([]);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("loads the live details by itself, with no button", async () => {
    render(<PlaceLive place={place} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(await screen.findByText("Open now")).toBeInTheDocument();
    expect(service.liveDetails).toHaveBeenCalledWith("g1", expect.any(String));
  });

  it("doesn't ask Google again when the place is reopened", async () => {
    render(<PlaceLive place={place} />);
    await screen.findByText("Open now");
    cleanup();
    render(<PlaceLive place={place} />);
    await screen.findByText("Open now");
    expect(service.liveDetails).toHaveBeenCalledTimes(1);
  });

  it("says quietly when Google doesn't answer", async () => {
    service.liveDetails.mockRejectedValue(new MapsError("failed"));
    render(<PlaceLive place={place} />);
    expect(
      await screen.findByText("Google didn't answer. Try again later."),
    ).toBeInTheDocument();
  });

  it("shows nothing for a place Google has no photos of", async () => {
    const { container } = render(<PlacePhotos place={place} />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(service.photos).toHaveBeenCalledWith("g1");
  });

  it("asks Google for nothing without a place ID", () => {
    const unmatched = { ...place, googlePlaceId: null };
    render(
      <>
        <PlaceLive place={unmatched} />
        <PlacePhotos place={unmatched} />
      </>,
    );
    expect(service.liveDetails).not.toHaveBeenCalled();
    expect(service.photos).not.toHaveBeenCalled();
  });
});
