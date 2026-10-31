import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession } from "@/lib/auth";
import {
  deployedVersion,
  resetApp,
  storedVersion,
  triedVersion,
} from "@/lib/app-reset";

vi.mock("@/lib/auth", () => ({ clearSession: vi.fn() }));

const replace = vi.fn();

describe("resetApp", () => {
  beforeEach(() => {
    vi.mocked(clearSession).mockReset().mockResolvedValue(undefined);
    replace.mockReset();
    vi.stubGlobal("location", { replace });
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("trip-id", "trip-1");
    localStorage.setItem("maps-taps", "{}");
    localStorage.setItem("locale", "es");
    localStorage.setItem("theme", "dark");
    localStorage.setItem("device-name", "Ana's phone");
    sessionStorage.setItem("anything", "x");
  });

  it("signs out, clears storage but keeps preferences, and reloads", async () => {
    await resetApp("1.0.1");

    expect(clearSession).toHaveBeenCalled();
    expect(localStorage.getItem("trip-id")).toBeNull();
    expect(localStorage.getItem("maps-taps")).toBeNull();
    expect(sessionStorage.getItem("anything")).toBeNull();
    expect(localStorage.getItem("locale")).toBe("es");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(localStorage.getItem("device-name")).toBe("Ana's phone");
    expect(storedVersion()).toBe("1.0.1");
    expect(triedVersion()).toBe("1.0.1");
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("?v=1.0.1"));
  });

  it("still clears and reloads when signing out fails", async () => {
    vi.mocked(clearSession).mockRejectedValue(new Error("offline"));
    await resetApp("1.0.1");
    expect(localStorage.getItem("trip-id")).toBeNull();
    expect(replace).toHaveBeenCalled();
  });
});

describe("deployedVersion", () => {
  it("reads the version from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: "1.0.2" }),
      }),
    );
    expect(await deployedVersion()).toBe("1.0.2");
  });

  it("has no answer offline or on a bad response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await deployedVersion()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await deployedVersion()).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    expect(await deployedVersion()).toBeNull();
  });
});
