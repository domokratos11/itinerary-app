import { beforeEach, describe, expect, it } from "vitest";

import {
  parseTripId,
  recallTripId,
  rememberTripId,
  resolveTripId,
} from "@/lib/trip-id";

describe("parseTripId", () => {
  it("accepts a Firestore auto-ID", () => {
    expect(parseTripId("Ab3dE9fG1hJ2kL4mN5pQ")).toBe("Ab3dE9fG1hJ2kL4mN5pQ");
  });

  it("rejects empty, short or path-like values", () => {
    expect(parseTripId(null)).toBeNull();
    expect(parseTripId("abc")).toBeNull();
    expect(parseTripId("trips/abc123")).toBeNull();
  });
});

describe("resolveTripId", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses the ID in the link and remembers it", () => {
    expect(resolveTripId("Ab3dE9fG1hJ2kL4mN5pQ")).toBe("Ab3dE9fG1hJ2kL4mN5pQ");
    expect(recallTripId()).toBe("Ab3dE9fG1hJ2kL4mN5pQ");
  });

  it("falls back to the remembered ID when the link has none", () => {
    rememberTripId("Ab3dE9fG1hJ2kL4mN5pQ");
    expect(resolveTripId(null)).toBe("Ab3dE9fG1hJ2kL4mN5pQ");
  });

  it("returns null when nothing is known", () => {
    expect(resolveTripId(null)).toBeNull();
  });
});
