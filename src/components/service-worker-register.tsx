"use client";

import { useEffect } from "react";

import { BASE_PATH } from "@/lib/base-path";

// Registers the precaching service worker written by workbox-config.cjs.
// Production only, so development never serves stale files.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
      .catch(() => {
        // Without the worker the app still works online.
      });
  }, []);
  return null;
}
