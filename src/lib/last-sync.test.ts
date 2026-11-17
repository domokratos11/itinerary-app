import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  noteServerRead,
  noteServerState,
  storedLastSync,
  useSyncAge,
} from "@/lib/last-sync";

describe("last sync", () => {
  beforeEach(() => {
    localStorage.clear();
    noteServerState(true);
    localStorage.clear();
  });

  it("records nothing from the device's own copy", () => {
    noteServerState(true);
    expect(storedLastSync()).toBeNull();
  });

  it("stamps when the copy matches the server, and reads as now", () => {
    vi.useFakeTimers({ now: new Date("2026-12-20T10:00:00Z") });
    noteServerState(false);
    expect(storedLastSync()?.toISOString()).toBe("2026-12-20T10:00:00.000Z");
    const { result } = renderHook(() => useSyncAge());
    expect(result.current).toEqual({
      freshness: "fresh",
      value: 0,
      unit: "minute",
    });
    vi.useRealTimers();
  });

  it("stamps again when the connection goes, the last moment it matched", () => {
    vi.useFakeTimers({ now: new Date("2026-12-20T10:00:00Z") });
    noteServerState(false);
    vi.setSystemTime(new Date("2026-12-20T11:30:00Z"));
    noteServerState(true);
    expect(storedLastSync()?.toISOString()).toBe("2026-12-20T11:30:00.000Z");
    vi.useRealTimers();
  });

  it("ages from the stamp once out of sync", () => {
    localStorage.setItem("last-server-sync", "2026-12-16T10:00:00.000Z");
    vi.useFakeTimers({ now: new Date("2026-12-20T10:00:00Z") });
    const { result } = renderHook(() => useSyncAge());
    expect(result.current).toEqual({
      freshness: "stale",
      value: 4,
      unit: "day",
    });
    act(() => noteServerRead());
    vi.useRealTimers();
  });
});
