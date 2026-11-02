import { create } from "zustand";

const KEY = "hide-amounts";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

// Whether money is hidden on this device, for showing the Dashboard or Budget
// to someone. Remembered, so a reload can't reveal the amounts by surprise.
export const useHideAmounts = create<{ hidden: boolean }>()(() => ({
  hidden: read(),
}));

export function setHideAmounts(hidden: boolean): void {
  useHideAmounts.setState({ hidden });
  try {
    localStorage.setItem(KEY, String(hidden));
  } catch {
    // Blocked storage: it stays as chosen until the page reloads.
  }
}
