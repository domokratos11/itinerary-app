import { describe, expect, it } from "vitest";

import { syncAge } from "@/domain/sync-age";

const now = new Date("2026-12-20T12:00:00Z");
const ago = (ms: number) => new Date(+now - ms);

describe("syncAge", () => {
  it("says never without a recorded sync", () => {
    expect(syncAge(null, now).freshness).toBe("never");
  });

  it("uses minutes, hours, then days", () => {
    expect(syncAge(ago(5 * 60_000), now)).toEqual({
      freshness: "fresh",
      value: 5,
      unit: "minute",
    });
    expect(syncAge(ago(3 * 3_600_000), now)).toMatchObject({
      value: 3,
      unit: "hour",
    });
    expect(syncAge(ago(2 * 86_400_000), now)).toMatchObject({
      freshness: "fresh",
      value: 2,
      unit: "day",
    });
  });

  it("is stale from three days", () => {
    expect(syncAge(ago(3 * 86_400_000), now).freshness).toBe("stale");
  });

  it("treats a clock behind the record as just now", () => {
    expect(syncAge(new Date(+now + 60_000), now)).toMatchObject({ value: 0 });
  });
});
