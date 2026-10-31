import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/auth-store";
import { getLocale, setLocale } from "@/lib/i18n";
import { LocalTripRepository } from "@/lib/local-trip-repository";
import { LocalUserRepository } from "@/lib/local-user-repository";
import { useAuthSync } from "@/lib/use-auth-sync";

const ana = { uid: "u1", email: "Ana@Example.com", name: "Ana" };
let signedIn: typeof ana | null = ana;
vi.mock("@/lib/auth", () => ({
  watchUser: (onUser: (user: typeof ana | null) => void) => {
    onUser(signedIn);
    return () => {};
  },
}));
// The real instances reach Firestore; these tests pass their own.
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/user-repository-instance", () => ({ userRepository: {} }));

const store = () => useAuthStore.getState();

describe("useAuthSync", () => {
  beforeEach(() => {
    signedIn = ana;
    window.localStorage.clear();
    useAuthStore.setState({
      status: "loading",
      user: null,
      trips: null,
      tripsFailed: false,
      tripId: null,
      access: "checking",
    });
  });

  it("finds a new browser's trip after sign-in, with no link", async () => {
    const trips = new LocalTripRepository();
    const id = await trips.createTrip("Japan", "ana@example.com");
    const users = new LocalUserRepository();
    renderHook(() => useAuthSync(null, trips, users));

    await waitFor(() => expect(store().access).toBe("member"));
    expect(store().tripId).toBe(id);
    expect(window.localStorage.getItem("trip-id")).toBe(id);
    expect((await users.get("u1")).lastTripId).toBe(id);
  });

  it("leaves two trips for the user to pick", async () => {
    const trips = new LocalTripRepository();
    await trips.createTrip("Japan", "ana@example.com");
    await trips.createTrip("Peru", "ana@example.com");
    const users = new LocalUserRepository();
    renderHook(() => useAuthSync(null, trips, users));

    await waitFor(() => expect(store().trips).toHaveLength(2));
    expect(store().tripId).toBeNull();
  });

  it("doesn't remember a trip the user was refused", async () => {
    const trips = new LocalTripRepository("denied");
    const users = new LocalUserRepository();
    renderHook(() => useAuthSync("someoneElsesTrip", trips, users));

    await waitFor(() => expect(store().access).toBe("denied"));
    expect(window.localStorage.getItem("trip-id")).toBeNull();
  });

  it("uses the language saved for this person", async () => {
    const users = new LocalUserRepository();
    await users.update("u1", { language: "es" });
    const trips = new LocalTripRepository();
    renderHook(() => useAuthSync(null, trips, users));

    await waitFor(() => expect(getLocale()).toBe("es"));
    setLocale("en");
  });

  it("saves the current language for someone with none yet", async () => {
    const users = new LocalUserRepository();
    setLocale("es");
    const trips = new LocalTripRepository();
    renderHook(() => useAuthSync(null, trips, users));

    await waitFor(async () =>
      expect((await users.get("u1")).language).toBe("es"),
    );
    setLocale("en");
  });

  it("opens nothing for someone signed out", async () => {
    signedIn = null;
    const trips = new LocalTripRepository();
    const users = new LocalUserRepository();
    renderHook(() => useAuthSync("tripAAAAAA", trips, users));

    await waitFor(() => expect(store().status).toBe("signed-out"));
    expect(store().tripId).toBeNull();
    expect(store().access).toBe("checking");
  });
});
