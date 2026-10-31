"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Splash } from "@/components/app-gate";
import { APP_VERSION, resetApp } from "@/lib/app-reset";
import { checkForUpdate, storageIsStale } from "@/lib/version-check";

// How long the first check for a newer deploy may hold back the app. A slow
// answer still resets when it arrives.
const FIRST_CHECK_MS = 2000;

// Runs before anything else on every page, so nothing starts on storage left
// by another version. Checks again whenever the app returns to the screen.
// Development has no deploys to compare with.
export function VersionGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(process.env.NODE_ENV !== "production");

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    removeVersionFromUrl();
    if (storageIsStale()) {
      void resetApp(APP_VERSION);
      return;
    }
    const proceed = window.setTimeout(() => setReady(true), FIRST_CHECK_MS);
    void checkForUpdate().then((result) => {
      if (result === "updating") return;
      window.clearTimeout(proceed);
      setReady(true);
    });
    const recheck = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.clearTimeout(proceed);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, []);

  return ready ? children : <Splash />;
}

// The ?v= from a reset has done its job by now.
function removeVersionFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("v")) return;
  url.searchParams.delete("v");
  window.history.replaceState(null, "", url);
}
