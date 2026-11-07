// The offline copy of the trip lives in IndexedDB. Browsers may clear a
// site's storage when space runs low or (Safari) after a while without a
// visit; asking for persistent storage keeps it, if the browser agrees.

export type StorageStatus = "kept" | "may-be-cleared" | "unsupported";

function storage(): StorageManager | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.storage;
}

export async function storageStatus(): Promise<StorageStatus> {
  const manager = storage();
  if (!manager?.persisted) return "unsupported";
  try {
    return (await manager.persisted()) ? "kept" : "may-be-cleared";
  } catch {
    return "unsupported";
  }
}

// Asks once it's needed; the browser decides without a prompt in most
// cases (Chrome by engagement, Safari for home-screen apps).
export async function requestPersistentStorage(): Promise<StorageStatus> {
  const manager = storage();
  if (!manager?.persist) return "unsupported";
  const status = await storageStatus();
  if (status !== "may-be-cleared") return status;
  try {
    return (await manager.persist()) ? "kept" : "may-be-cleared";
  } catch {
    return "may-be-cleared";
  }
}
