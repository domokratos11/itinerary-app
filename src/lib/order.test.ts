import { describe, expect, it } from "vitest";

import { keyAfter, keyBetween } from "@/lib/order";

describe("order keys", () => {
  it("starts an empty list with a key", () => {
    expect(keyAfter(null)).toBeTypeOf("string");
  });

  it("puts a new item after the last one", () => {
    const first = keyAfter(null);
    const second = keyAfter(first);
    expect(second > first).toBe(true);
  });

  it("fits an item between two neighbours without touching them", () => {
    const first = keyAfter(null);
    const third = keyAfter(keyAfter(first));
    const middle = keyBetween(first, third);
    expect(middle > first && middle < third).toBe(true);
  });
});
