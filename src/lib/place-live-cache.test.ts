import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapsError } from "@/domain/maps-service";
import {
  clearLiveCache,
  livePlace,
  LIVE_CACHE_MS,
  placePhotos,
  showPhoto,
  shownPhotos,
} from "./place-live-cache";
import { TAP_LIMITS } from "./tap-limit";

const service = vi.hoisted(() => ({
  liveDetails: vi.fn(),
  photos: vi.fn(),
}));
vi.mock("@/lib/maps-service-instance", () => ({ mapsService: service }));

const NOW = Date.parse("2026-12-20T03:00:00.000Z");
const answer = {
  openNow: true,
  rating: 4.5,
  ratingCount: 10,
  todayHours: "10-18",
  mapsUrl: null,
};

describe("the place details cache", () => {
  // The daily count also lives in memory, so each test gets a day of its own.
  let day = 1;

  beforeEach(() => {
    vi.setSystemTime(new Date(Date.UTC(2026, 11, day++, 3)));
    localStorage.clear();
    clearLiveCache();
    service.liveDetails.mockReset().mockResolvedValue(answer);
    service.photos.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks Google once while the answer is fresh", async () => {
    await livePlace("p1", NOW);
    await expect(livePlace("p1", NOW + LIVE_CACHE_MS - 1)).resolves.toBe(
      answer,
    );
    expect(service.liveDetails).toHaveBeenCalledTimes(1);
  });

  it("shares one call between two asks at once", async () => {
    await Promise.all([placePhotos("p1", NOW), placePhotos("p1", NOW)]);
    expect(service.photos).toHaveBeenCalledTimes(1);
  });

  it("asks again once the answer is old", async () => {
    await livePlace("p1", NOW);
    await livePlace("p1", NOW + LIVE_CACHE_MS);
    expect(service.liveDetails).toHaveBeenCalledTimes(2);
  });

  it("keeps each place apart", async () => {
    await livePlace("p1", NOW);
    await livePlace("p2", NOW);
    expect(service.liveDetails).toHaveBeenCalledTimes(2);
  });

  it("doesn't keep a failure", async () => {
    service.liveDetails.mockRejectedValueOnce(new MapsError("offline"));
    await expect(livePlace("p1", NOW)).rejects.toThrow("offline");
    await expect(livePlace("p1", NOW)).resolves.toBe(answer);
  });

  it("counts only real calls to the daily limit", async () => {
    for (let i = 0; i < TAP_LIMITS.live + 5; i++) await livePlace("p1", NOW);
    expect(service.liveDetails).toHaveBeenCalledTimes(1);
    await expect(livePlace("p2", NOW)).resolves.toBe(answer);
  });

  it("refuses new places past the limit, but not known ones", async () => {
    await livePlace("known", NOW);
    for (let i = 1; i < TAP_LIMITS.live; i++) await livePlace(`p${i}`, NOW);
    await expect(livePlace("one-more", NOW)).rejects.toMatchObject({
      kind: "quota",
    });
    await expect(livePlace("known", NOW)).resolves.toBe(answer);
    expect(service.liveDetails).toHaveBeenCalledTimes(TAP_LIMITS.live);
  });

  it("counts each photo once, even after coming back to it", async () => {
    await placePhotos("p1", NOW);
    expect(showPhoto("p1", 0)).toBe(true);
    expect(showPhoto("p1", 1)).toBe(true);
    expect(showPhoto("p1", 1)).toBe(true);
    expect([...shownPhotos("p1")]).toEqual([0, 1]);
    const counts = JSON.parse(localStorage.getItem("maps-taps") ?? "{}") as {
      photo: number;
    };
    expect(counts.photo).toBe(2);
  });
});
