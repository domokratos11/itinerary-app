import { afterEach, describe, expect, it, vi } from "vitest";

import { requestPersistentStorage, storageStatus } from "./storage-persist";

// jsdom has no navigator.storage, so each test puts its own in place.
function mockStorage(storage: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, "storage", {
    value: storage,
    configurable: true,
  });
}

describe("persistent storage", () => {
  afterEach(() => mockStorage(undefined));

  it("reports a browser without the API", async () => {
    mockStorage(undefined);
    expect(await storageStatus()).toBe("unsupported");
    expect(await requestPersistentStorage()).toBe("unsupported");
  });

  it("doesn't ask again once storage is kept", async () => {
    const persist = vi.fn();
    mockStorage({ persisted: async () => true, persist });
    expect(await requestPersistentStorage()).toBe("kept");
    expect(persist).not.toHaveBeenCalled();
  });

  it("asks, and reports what the browser decided", async () => {
    mockStorage({ persisted: async () => false, persist: async () => true });
    expect(await requestPersistentStorage()).toBe("kept");
    mockStorage({ persisted: async () => false, persist: async () => false });
    expect(await requestPersistentStorage()).toBe("may-be-cleared");
  });
});
