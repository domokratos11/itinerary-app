import { clearSession } from "@/lib/auth";
import { BASE_PATH } from "@/lib/base-path";
import { currentShareId } from "@/lib/viewer-store";

// The version this copy of the app was built as.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

// Preferences, not trip data. They survive a reset, so someone who reads
// Spanish still gets a Spanish sign-in screen after an update.
const KEPT_KEYS = [
  "locale",
  "theme",
  "palette",
  "device-name",
  "sidebar-open",
  "hide-amounts",
  "display-currency",
  "days-view",
  "quick-expense-category",
  "payment-method",
  "kanji-size",
];
// Kept too when an update stays within the release (sameRelease): the
// sign-in and the offline trip are kept then, so these still match them.
const SESSION_KEYS = ["trip-id", "last-server-sync"];
const VERSION_KEY = "app-version";
// The version this tab last reset for. GitHub Pages may keep serving the old
// page for a few minutes after a deploy, and resetting again wouldn't help.
const ATTEMPT_KEY = "app-version-attempt";

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

export function canStore(): boolean {
  try {
    local().setItem(VERSION_KEY, local().getItem(VERSION_KEY) ?? "");
    if (local().getItem(VERSION_KEY) === "") local().removeItem(VERSION_KEY);
    return true;
  } catch {
    return false;
  }
}

export function storedVersion(): string | null {
  return read(local, VERSION_KEY);
}

export function triedVersion(): string | null {
  return read(session, ATTEMPT_KEY);
}

// Records that this device's storage now belongs to `version`, without
// clearing anything: for an update within the release that the service
// worker has already brought in.
export function adoptVersion(version: string): void {
  try {
    local().setItem(VERSION_KEY, version);
  } catch {
    // Blocked storage remembers nothing.
  }
}

function clearStorage(target: string, keepSession: boolean): void {
  const kept = keepSession ? [...KEPT_KEYS, ...SESSION_KEYS] : KEPT_KEYS;
  try {
    for (const key of Object.keys(local()))
      if (!kept.includes(key)) local().removeItem(key);
    local().setItem(VERSION_KEY, target);
    session().clear();
    session().setItem(ATTEMPT_KEY, target);
  } catch {
    // Blocked storage has nothing to clear.
  }
}

async function clearCaches(): Promise<void> {
  try {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    const workers = await navigator.serviceWorker.getRegistrations();
    await Promise.all(workers.map((worker) => worker.unregister()));
  } catch {
    // Not available here, so nothing is cached.
  }
}

// Loads `target` afresh: the service worker and its caches go, so every file
// comes from the new build. By default it also leaves the device as if the
// app had never been opened, apart from preferences, and the person has to
// sign in again. With `keepSession` (an update within the release) the
// sign-in, the offline trip and edits still waiting to upload all stay.
// Call it only with a connection: without one the reload has nothing to load.
export async function resetApp(
  target: string,
  { keepSession = false }: { keepSession?: boolean } = {},
): Promise<void> {
  // Someone on a read-only link stays on it after the reset. Read from the
  // address, as on a first visit this runs before viewer mode has started.
  const share = currentShareId();
  try {
    if (!share && !keepSession) await clearSession();
  } catch {
    // Carry on: the rest still clears what it can.
  }
  clearStorage(target, keepSession);
  await clearCaches();
  // The query string gets past a browser that cached the old page.
  const query = new URLSearchParams({ v: target });
  if (share) query.set("share", share);
  window.location.replace(`${BASE_PATH}/?${query}`);
}

// What the server says is deployed, or null without an answer. No answer
// never clears anything, so the app keeps working offline.
export async function deployedVersion(): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_PATH}/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const { version } = (await response.json()) as { version?: unknown };
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}
