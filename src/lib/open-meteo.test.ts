import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forecast, locateCity, placeQueries, typical } from "./open-meteo";

const json = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe("open-meteo", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("looks a city up by its name, then its first word", async () => {
    expect(placeQueries("Tokyo (Ueno)")).toEqual(["Tokyo (Ueno)", "Tokyo"]);
    fetchMock
      .mockReturnValueOnce(json({}))
      .mockReturnValueOnce(
        json({ results: [{ latitude: 35.69, longitude: 139.69 }] }),
      );
    expect(await locateCity("Tokyo (Ueno)")).toEqual({
      lat: 35.69,
      lng: 139.69,
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain("name=Tokyo&");
    // Asked once, then remembered.
    await locateCity("Tokyo (Ueno)");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads the forecast by date", async () => {
    fetchMock.mockReturnValueOnce(
      json({
        daily: {
          time: ["2026-12-15", "2026-12-16"],
          weather_code: [61, null],
          temperature_2m_max: [9.4, 10],
          temperature_2m_min: [3.1, 2],
          precipitation_probability_max: [80, 10],
        },
      }),
    );
    const days = await forecast({ lat: 35.01, lng: 135.77 });
    expect(days["2026-12-15"]).toEqual({
      kind: "rain",
      maxC: 9.4,
      minC: 3.1,
      precipPct: 80,
      source: "forecast",
    });
    expect(days["2026-12-16"]).toBeUndefined();
  });

  it("builds typical weather from the same dates in three past years", async () => {
    fetchMock.mockImplementation((url: string) => {
      const year = Number(url.match(/start_date=(\d{4})/)![1]);
      return json({
        daily: {
          time: [`${year}-12-20`],
          weather_code: [year === 2025 ? 71 : 3],
          temperature_2m_max: [8],
          temperature_2m_min: [1],
          precipitation_sum: [year === 2025 ? 5 : 0],
        },
      });
    });
    const days = await typical({ lat: 43.06, lng: 141.35 }, ["2026-12-20"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(days["2026-12-20"]).toMatchObject({
      kind: "cloudy",
      maxC: 8,
      precipPct: 33,
      source: "typical",
    });
  });
});
