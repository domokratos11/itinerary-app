import {
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

// Resets for a newer deploy, once per tab unless `force` is set.
export async function checkForUpdate(force = false): Promise<UpdateCheck> {
  const deployed = await deployedVersion();
  if (deployed === null) return "unknown";
  if (deployed === APP_VERSION) return "current";
  if (!force && triedVersion() === deployed) return "current";
  await resetApp(deployed);
  return "updating";
}
