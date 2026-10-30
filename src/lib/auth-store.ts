"use client";

import { create } from "zustand";

import type { TripAccess } from "@/domain/trip-repository";
import type { SignedInUser } from "@/lib/auth";

type AuthState = {
  // "loading" until Firebase says whether someone is signed in.
  status: "loading" | "signed-out" | "signed-in";
  user: SignedInUser | null;
  // Whether the signed-in user is on the open trip's member list.
  access: TripAccess;
  setUser: (user: SignedInUser | null) => void;
  setAccess: (access: TripAccess) => void;
};

// Fed by use-auth-sync.
export const useAuthStore = create<AuthState>()((set) => ({
  status: "loading",
  user: null,
  access: "checking",
  setUser: (user) =>
    set({
      user,
      status: user ? "signed-in" : "signed-out",
      access: "checking",
    }),
  setAccess: (access) => set({ access }),
}));
