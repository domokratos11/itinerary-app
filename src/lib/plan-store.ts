import { create } from "zustand";

import type { PlanItem } from "@/domain/schemas";

type PlanState = {
  items: PlanItem[];
  // False until the first snapshot arrives for the current trip.
  ready: boolean;
  setItems: (items: PlanItem[]) => void;
  reset: () => void;
};

// Fed by the Firestore listener in use-plan-sync.
export const usePlanStore = create<PlanState>()((set) => ({
  items: [],
  ready: false,
  setItems: (items) => set({ items, ready: true }),
  reset: () => set({ items: [], ready: false }),
}));
