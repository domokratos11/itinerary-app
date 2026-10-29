"use client";

import { useSyncExternalStore } from "react";

// Shown while the phone has no connection. Edits are still saved on the
// phone and sent when the connection returns.
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="bg-muted px-4 py-2 text-center text-sm text-muted-foreground"
    >
      Offline. Changes are saved on this phone and will sync when you&apos;re back online.
    </div>
  );
}
