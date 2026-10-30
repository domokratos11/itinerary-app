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

  it("leaves other paths alone", () => {
    expect(newAddressFor("/nothing/", "")).toBeNull();
  });
});
