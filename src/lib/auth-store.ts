"use client";

import { create } from "zustand";

import type { TripAccess, TripSummary } from "@/domain/trip-repository";
import type { SignedInUser } from "@/lib/auth";

type AuthState = {
  // "loading" until Firebase says whether someone is signed in.
  status: "loading" | "signed-out" | "signed-in";
  user: SignedInUser | null;
  // The signed-in user's trips. Null until the list has answered.
  trips: TripSummary[] | null;
  // The list was refused or failed, so it will not answer.
  tripsFailed: boolean;
  canCreateTrips: boolean;
  // The open trip, and whether the user is on its member list.
  tripId: string | null;
  access: TripAccess;
  setUser: (user: SignedInUser | null) => void;
  setTrips: (trips: TripSummary[]) => void;
  setTripsFailed: () => void;
  setCanCreateTrips: (can: boolean) => void;
  setTripId: (tripId: string | null) => void;
  setAccess: (access: TripAccess) => void;
};

// Fed by use-auth-sync.
export const useAuthStore = create<AuthState>()((set) => ({
  status: "loading",
  user: null,
  trips: null,
  tripsFailed: false,
  canCreateTrips: false,
  tripId: null,
  access: "checking",
  setUser: (user) =>
    set({
      user,
      status: user ? "signed-in" : "signed-out",
      trips: null,
      tripsFailed: false,
      canCreateTrips: false,
      tripId: null,
      access: "checking",
    }),
  setTrips: (trips) => set({ trips, tripsFailed: false }),
  setTripsFailed: () => set({ tripsFailed: true }),
  setCanCreateTrips: (canCreateTrips) => set({ canCreateTrips }),
  setTripId: (tripId) => set({ tripId }),
  setAccess: (access) => set({ access }),
}));

// The open trip's name and members. Null if it isn't in the list, which
// happens only when the list can't be read.
export function useActiveTrip(): TripSummary | null {
  return useAuthStore(
    (s) => s.trips?.find((trip) => trip.id === s.tripId) ?? null,
  );
}
