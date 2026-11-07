import { FirebaseError } from "firebase/app";
import { afterEach, describe, expect, it, vi } from "vitest";

const signInWithPopup = vi.fn();
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  onAuthStateChanged: vi.fn(),
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signOut: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ getDb: vi.fn(), getFirebaseAuth: vi.fn() }));

import {
  isStandalone,
  SIGN_IN_TIMEOUT_MS,
  signInErrorKey,
  signInWithGoogle,
} from "./auth";

describe("signInErrorKey", () => {
  it("words the known Firebase errors", () => {
    expect(signInErrorKey("auth/too-many-requests", false)).toBe(
      "auth.tooMany",
    );
    expect(signInErrorKey("auth/popup-blocked", false)).toBe(
      "auth.popupBlocked",
    );
    expect(signInErrorKey("auth/something-new", false)).toBe("auth.failed");
  });

  it("asks the home-screen app to restart when the popup can't reach it", () => {
    expect(signInErrorKey("auth/popup-blocked", true)).toBe(
      "auth.standaloneRetry",
    );
    expect(signInErrorKey("auth/internal-error", true)).toBe(
      "auth.standaloneRetry",
    );
    expect(signInErrorKey("auth/network-request-failed", true)).toBe(
      "auth.network",
    );
  });
});

describe("signInWithGoogle", () => {
  afterEach(() => {
    vi.useRealTimers();
    signInWithPopup.mockReset();
  });

  it("resolves false when the popup is closed", async () => {
    signInWithPopup.mockRejectedValue(
      new FirebaseError("auth/popup-closed-by-user", "closed"),
    );
    await expect(signInWithGoogle()).resolves.toBe(false);
  });

  it("stops waiting for a popup that never answers", async () => {
    vi.useFakeTimers();
    signInWithPopup.mockReturnValue(new Promise(() => {}));
    const attempt = signInWithGoogle();
    const outcome = expect(attempt).rejects.toThrow(/didn't finish/);
    await vi.advanceTimersByTimeAsync(SIGN_IN_TIMEOUT_MS);
    await outcome;
  });
});

describe("isStandalone", () => {
  it("is false in a browser tab", () => {
    expect(isStandalone()).toBe(false);
  });
});
