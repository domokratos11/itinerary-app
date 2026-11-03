import { describe, expect, it } from "vitest";

import { sunTimes } from "./sun";

function minutes(clock: string) {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
}

describe("sunTimes", () => {
  // Published times for central Tokyo (NAOJ): Dec 21, 2026 about 06:47 and
  // 16:32; Jan 10, 2027 about 06:51 and 16:44.
  it.each([
    ["2026-12-21", "06:47", "16:32"],
    ["2027-01-10", "06:51", "16:44"],
  ])("matches Tokyo on %s within two minutes", (date, rise, set) => {
    const times = sunTimes(date, 35.6895, 139.6917)!;
    expect(
      Math.abs(minutes(times.sunrise) - minutes(rise)),
    ).toBeLessThanOrEqual(2);
    expect(Math.abs(minutes(times.sunset) - minutes(set))).toBeLessThanOrEqual(
      2,
    );
    expect(times.daylightMin).toBeGreaterThan(580);
    expect(times.daylightMin).toBeLessThan(600);
  });

  it("sets later further west, as in Kyoto", () => {
    const tokyo = sunTimes("2026-12-21", 35.6895, 139.6917)!;
    const kyoto = sunTimes("2026-12-21", 35.0116, 135.7681)!;
    expect(minutes(kyoto.sunset)).toBeGreaterThan(minutes(tokyo.sunset) + 10);
  });
});
