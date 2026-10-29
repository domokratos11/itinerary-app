import { create } from "zustand";

import type { PlanItem } from "@/domain/schemas";

type PlanState = {
  items: PlanItem[];
  // False until the first snapshot arrives for the current trip.
  ready: boolean;
  // Set when the listener is refused, for example by the rules.
  error: string | null;
  setItems: (items: PlanItem[]) => void;
  setError: (message: string) => void;
  reset: () => void;
};

// Fed by the Firestore listener in use-plan-sync.
export const usePlanStore = create<PlanState>()((set) => ({
  items: [],
  ready: false,
  error: null,
  setItems: (items) => set({ items, ready: true, error: null }),
  setError: (message) => set({ error: message, ready: false }),
  reset: () => set({ items: [], ready: false, error: null }),
}));
