import { sameRelease } from "@/domain/version";
import {
  adoptVersion,
  APP_VERSION,
  canStore,
  deployedVersion,
  resetApp,
  storedVersion,
  triedVersion,
} from "@/lib/app-reset";

// Called before anything else runs. Whether this device last ran a different
// version than this page, which means its storage belongs to that one.
export function storageIsStale(): boolean {
  // With storage blocked nothing can be remembered, and nothing kept either.
  if (!canStore()) return false;
  const stored = storedVersion();
  if (stored === APP_VERSION) return false;
  // The reset for `stored` already ran in this tab and the old page came back
  // anyway: carry on with it rather than reset in a loop.
  return stored === null || triedVersion() !== stored;
}

export type UpdateCheck = "current" | "unknown" | "updating";

// Resets for a newer deploy, once per tab unless `force` is set. Within the
// release the person stays signed in and keeps the offline trip.
export async function checkForUpdate(force = false): Promise<UpdateCheck> {
  const deployed = await deployedVersion();
  if (deployed === null) return "unknown";
  if (deployed === APP_VERSION) return "current";
  if (!force && triedVersion() === deployed) return "current";
  await resetApp(deployed, { keepSession: sameRelease(APP_VERSION, deployed) });
  return "updating";
}

// Run when the app starts and whenever it comes back. First makes this
// device's storage fit this page, then looks for a newer deploy.
//
// The service worker can bring in a newer page in the background, so the
// page may open on storage from the version before. Within the release that
// storage still fits: it is simply adopted, with no reload, which also works
// offline. A new release needs a full reset, and that waits for a connection:
// reset offline, the reload would find nothing and lock the person out. Until
// then the app carries on, and the next check (on return, or when the
// connection comes back) does it.
export async function startupCheck(): Promise<UpdateCheck> {
  if (storageIsStale()) {
    const stored = storedVersion();
    if (stored !== null && sameRelease(stored, APP_VERSION)) {
      adoptVersion(APP_VERSION);
    } else {
      const deployed = await deployedVersion();
      if (deployed === null) return "unknown";
      await resetApp(deployed);
      return "updating";
    }
  }
  return checkForUpdate();
}
