import { beforeEach, describe, expect, it, vi } from "vitest";

import { deployedVersion, resetApp, storedVersion } from "@/lib/app-reset";
import {
  checkForUpdate,
  startupCheck,
  storageIsStale,
} from "@/lib/version-check";

vi.mock("@/lib/app-reset", async (original) => ({
  ...(await original<typeof import("@/lib/app-reset")>()),
  APP_VERSION: "1.0.0",
  resetApp: vi.fn(),
  deployedVersion: vi.fn(),
}));

describe("storageIsStale", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("is false when storage is from this version", () => {
    localStorage.setItem("app-version", "1.0.0");
    expect(storageIsStale()).toBe(false);
  });

  it("is true for an older version or none at all", () => {
    expect(storageIsStale()).toBe(true);
    localStorage.setItem("app-version", "0.9.0");
    expect(storageIsStale()).toBe(true);
  });

  it("is false when storage is blocked, or it would reset forever", () => {
    const blocked = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(storageIsStale()).toBe(false);
    blocked.mockRestore();
  });

  it("is false when this tab already reset and got the old page back", () => {
    localStorage.setItem("app-version", "1.0.1");
    sessionStorage.setItem("app-version-attempt", "1.0.1");
    expect(storageIsStale()).toBe(false);
  });
});

describe("checkForUpdate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(resetApp).mockReset();
    vi.mocked(deployedVersion).mockReset();
  });

  it("clears nothing without an answer, so offline use is safe", async () => {
    vi.mocked(deployedVersion).mockResolvedValue(null);
    expect(await checkForUpdate()).toBe("unknown");
    expect(resetApp).not.toHaveBeenCalled();
  });

  it("does nothing when already on the deployed version", async () => {
    vi.mocked(deployedVersion).mockResolvedValue("1.0.0");
    expect(await checkForUpdate()).toBe("current");
    expect(resetApp).not.toHaveBeenCalled();
  });

  it("resets for a new version", async () => {
    vi.mocked(deployedVersion).mockResolvedValue("1.0.1");
    expect(await checkForUpdate()).toBe("updating");
    expect(resetApp).toHaveBeenCalledWith("1.0.1", { keepSession: true });
  });

  it("signs out only for a new major or minor version", async () => {
    vi.mocked(deployedVersion).mockResolvedValue("1.1.0");
    expect(await checkForUpdate()).toBe("updating");
    expect(resetApp).toHaveBeenCalledWith("1.1.0", { keepSession: false });
  });

  it("doesn't loop when the old page keeps coming back", async () => {
    vi.mocked(deployedVersion).mockResolvedValue("1.0.1");
    sessionStorage.setItem("app-version-attempt", "1.0.1");
    expect(await checkForUpdate()).toBe("current");
    expect(resetApp).not.toHaveBeenCalled();
  });

  it("tries again when asked to by hand", async () => {
    vi.mocked(deployedVersion).mockResolvedValue("1.0.1");
    sessionStorage.setItem("app-version-attempt", "1.0.1");
    expect(await checkForUpdate(true)).toBe("updating");
  });
});

describe("startupCheck", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(resetApp).mockReset();
    vi.mocked(deployedVersion).mockReset();
  });

  // The service worker brought in this page (1.0.0) while the device last
  // ran 1.0.9 of the same release: no reset, which also works offline.
  it("adopts storage from the same release and keeps everything", async () => {
    localStorage.setItem("app-version", "1.0.9");
    vi.mocked(deployedVersion).mockResolvedValue(null);
    expect(await startupCheck()).toBe("unknown");
    expect(resetApp).not.toHaveBeenCalled();
    expect(storedVersion()).toBe("1.0.0");
  });

  it("never resets offline, even for another release", async () => {
    localStorage.setItem("app-version", "0.9.9");
    vi.mocked(deployedVersion).mockResolvedValue(null);
    expect(await startupCheck()).toBe("unknown");
    expect(resetApp).not.toHaveBeenCalled();
    expect(storedVersion()).toBe("0.9.9");
  });

  it("resets fully for another release once there is a connection", async () => {
    localStorage.setItem("app-version", "0.9.9");
    vi.mocked(deployedVersion).mockResolvedValue("1.0.0");
    expect(await startupCheck()).toBe("updating");
    expect(resetApp).toHaveBeenCalledWith("1.0.0");
  });

  it("checks for a newer deploy when storage already fits", async () => {
    localStorage.setItem("app-version", "1.0.0");
    vi.mocked(deployedVersion).mockResolvedValue("1.0.0");
    expect(await startupCheck()).toBe("current");
    expect(resetApp).not.toHaveBeenCalled();
  });
});
