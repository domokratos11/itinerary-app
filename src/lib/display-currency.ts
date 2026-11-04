import { create } from "zustand";

export type DisplayCurrency = "JPY" | "USD";

const KEY = "display-currency";

function read(): DisplayCurrency {
  try {
    return localStorage.getItem(KEY) === "USD" ? "USD" : "JPY";
  } catch {
    return "JPY";
  }
}

// Which currency the Budget and Dashboard show amounts in on this device.
// Only how they're shown: everything is saved and counted in yen.
export const useDisplayCurrency = create<{ currency: DisplayCurrency }>()(
  () => ({ currency: read() }),
);

export function setDisplayCurrency(currency: DisplayCurrency): void {
  useDisplayCurrency.setState({ currency });
  try {
    localStorage.setItem(KEY, currency);
  } catch {
    // Blocked storage: it stays as chosen until the page reloads.
  }
}
