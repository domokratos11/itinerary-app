import { describe, expect, it } from "vitest";

import { newAddressFor } from "@/components/old-link-redirect";

describe("newAddressFor", () => {
  it("forwards an old day link and keeps the trip", () => {
    expect(newAddressFor("/day/2026-12-18/", "?trip=abc123")).toBe(
      "/day/?date=2026-12-18&trip=abc123",
    );
  });

  it("forwards an old city link", () => {
    expect(newAddressFor("/city/nagoya/", "")).toBe("/city/?id=nagoya");
  });

  it("forwards the old Queue page to the cities", () => {
    expect(newAddressFor("/queue/", "?trip=abc123")).toBe(
      "/cities/?trip=abc123",
    );
  });

  it("leaves other paths alone", () => {
    expect(newAddressFor("/nothing/", "")).toBeNull();
  });
});
