"use client";

import { useSyncExternalStore } from "react";

// True when the query matches. Server and first client render return false,
// so phone layouts are the default and wider screens switch after mount.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
