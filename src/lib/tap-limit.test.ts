import { beforeEach, describe, expect, it } from "vitest";

import { TAP_LIMITS, tryTap } from "./tap-limit";

const day1 = new Date("2026-12-20T03:00:00.000Z");
const day1Late = new Date("2026-12-20T14:00:00.000Z"); // Dec 20, 23:00 in Tokyo
const day2 = new Date("2026-12-20T16:00:00.000Z"); // Dec 21, 01:00 in Tokyo

describe("tryTap", () => {
  beforeEach(() => localStorage.clear());

  it("stops at the daily limit", () => {
    for (let i = 0; i < TAP_LIMITS.live; i++)
      expect(tryTap("live", day1)).toBe(true);
    expect(tryTap("live", day1Late)).toBe(false);
  });

  it("counts each kind apart", () => {
    for (let i = 0; i < TAP_LIMITS.live; i++) tryTap("live", day1);
    expect(tryTap("photo", day1)).toBe(true);
  });

  it("starts again at midnight in Japan", () => {
    for (let i = 0; i < TAP_LIMITS.live; i++) tryTap("live", day1);
    expect(tryTap("live", day2)).toBe(true);
  });
});
