// The name this phone signs its changes with in the activity log, e.g.
// "Rey's phone". Chosen once and kept in localStorage; storage can throw in
// private windows, so failures fall back to the default.
const STORAGE_KEY = "device-name";
export const DEFAULT_DEVICE_NAME = "Unnamed device";

export function getDeviceName(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_DEVICE_NAME;
  } catch {
    return DEFAULT_DEVICE_NAME;
  }
}

export function setDeviceName(name: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, name.trim().slice(0, 40));
  } catch {
    // Not kept; changes are signed with the default name.
  }
}
