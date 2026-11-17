"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { syncAge, type SyncAge } from "@/domain/sync-age";
import { intlLocale } from "@/lib/i18n";

// The last moment this device's copy of the trip was known to match the
// server. Firestore says so through `fromCache` on the trip document's
// listener (watchAccess). While it matches, "last synced" is now; once the
// connection goes, the stamp kept in localStorage is the answer. Only a full
// reset (a new release, or sign-out) clears it.
const KEY = "last-server-sync";

let inSync = false;
const listeners = new Set<() => void>();

function stamp(at = new Date()): void {
  try {
    localStorage.setItem(KEY, at.toISOString());
  } catch {
    // Blocked storage: the banner then says nothing about the age.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

// Called with each snapshot's `fromCache`. Stamps when the copy starts to
// match the server, and again when it stops: the last moment it was current.
export function noteServerState(fromCache: boolean): void {
  if (!fromCache || inSync) stamp();
  if (inSync === !fromCache) return;
  inSync = !fromCache;
  emit();
}

// After a full read from the server (the offline check's refresh).
export function noteServerRead(): void {
  stamp();
  emit();
}

export function storedLastSync(): Date | null {
  try {
    const value = localStorage.getItem(KEY);
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(+date) ? date : null;
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Leaving the app or losing the connection while current: keep the stamp
  // close to the real last moment.
  const keep = () => {
    if (inSync) stamp();
    if (!navigator.onLine) inSync = false;
    listener();
  };
  window.addEventListener("offline", keep);
  window.addEventListener("pagehide", keep);
  document.addEventListener("visibilitychange", keep);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("offline", keep);
    window.removeEventListener("pagehide", keep);
    document.removeEventListener("visibilitychange", keep);
  };
}

function snapshot(): string {
  return `${inSync}|${storedLastSync()?.toISOString() ?? ""}`;
}

// The age of the device's copy, refreshed every minute. "fresh" with 0
// minutes while it matches the server.
export function useSyncAge(): SyncAge {
  const state = useSyncExternalStore(subscribe, snapshot, () => "false|");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [current, last] = state.split("|");
  if (current === "true")
    return { freshness: "fresh", value: 0, unit: "minute" };
  return syncAge(last ? new Date(last) : null, now);
}

// "5 minutes ago", "2 days ago", in the app's language.
export function formatSyncAge(age: SyncAge): string {
  return new Intl.RelativeTimeFormat(intlLocale(), { numeric: "auto" }).format(
    -age.value,
    age.unit,
  );
}
