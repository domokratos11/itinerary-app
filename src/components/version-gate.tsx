"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Splash } from "@/components/app-gate";
import { initLocale } from "@/lib/i18n";
import { startupCheck } from "@/lib/version-check";

// How long the first check for a newer deploy may hold back the app. A slow
// answer still resets when it arrives.
const FIRST_CHECK_MS = 2000;

// Runs before anything else on every page, so nothing starts on storage left
// by another release (see startupCheck). Checks again whenever the app
// returns to the screen or the connection comes back.
// Development has no deploys to compare with.
export function VersionGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(process.env.NODE_ENV !== "production");

  useEffect(() => {
    initLocale();
    if (process.env.NODE_ENV !== "production") return;
    removeVersionFromUrl();
    const proceed = window.setTimeout(() => setReady(true), FIRST_CHECK_MS);
    void startupCheck().then((result) => {
      if (result === "updating") return;
      window.clearTimeout(proceed);
      setReady(true);
    });
    const recheck = () => {
      if (document.visibilityState === "visible") void startupCheck();
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("online", recheck);
    return () => {
      window.clearTimeout(proceed);
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("online", recheck);
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
