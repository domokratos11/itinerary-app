import { clearSession } from "@/lib/auth";
import { BASE_PATH } from "@/lib/base-path";

// The version this copy of the app was built as.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

// Preferences, not trip data. They survive a reset, so someone who reads
// Spanish still gets a Spanish sign-in screen after an update.
const KEPT_KEYS = ["locale", "theme", "device-name"];
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

function clearStorage(target: string): void {
  try {
    for (const key of Object.keys(local()))
      if (!KEPT_KEYS.includes(key)) local().removeItem(key);
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

// Leaves this device as if the app had never been opened, apart from
// preferences, and loads `target` afresh. The person has to sign in again.
export async function resetApp(target: string): Promise<void> {
  try {
    await clearSession();
  } catch {
    // Carry on: the rest still clears what it can.
  }
  clearStorage(target);
  await clearCaches();
  // The query string gets past a browser that cached the old page.
  window.location.replace(`${BASE_PATH}/?v=${encodeURIComponent(target)}`);
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
