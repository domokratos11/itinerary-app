import { useEffect } from "react";
import { create } from "zustand";

import { YEN_PER_USD } from "@/domain/budget";

// Today's dollar rate, from a free public service with no key (European
// Central Bank figures). Asked once per session; until it answers, or when
// offline, the fixed rate in domain/budget stands in. Amounts stay in yen.
const URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY";

type RateState = { rate: number; live: boolean };

export const useUsdRate = create<RateState>()(() => ({
  rate: YEN_PER_USD,
  live: false,
}));

let asked: Promise<void> | null = null;

export function loadUsdRate(): Promise<void> {
  asked ??= fetch(URL)
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { rates?: { JPY?: unknown } } | null) => {
      const rate = body?.rates?.JPY;
      if (typeof rate === "number" && rate > 0)
        useUsdRate.setState({ rate, live: true });
    })
    .catch(() => {
      // Offline or refused: the fixed rate stays, and the next call retries.
      asked = null;
    });
  return asked;
}

// The rate to use now, asking for today's in the background.
export function useCurrentUsdRate(): RateState {
  useEffect(() => {
    void loadUsdRate();
  }, []);
  return useUsdRate();
}
