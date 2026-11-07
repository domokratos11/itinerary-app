import { afterEach, describe, expect, it, vi } from "vitest";

import { prefersReducedMotion } from "./use-media-query";

function mockMatch(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matches && query === "(prefers-reduced-motion: reduce)",
    })),
  );
}

describe("prefersReducedMotion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("follows the phone's reduced-motion setting", () => {
    mockMatch(true);
    expect(prefersReducedMotion()).toBe(true);
    mockMatch(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});
