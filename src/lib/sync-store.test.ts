import { beforeEach, describe, expect, it } from "vitest";

import {
  syncStatus,
  trackStartupWrites,
  trackWrite,
  useSyncStore,
} from "./sync-store";

describe("sync store", () => {
  beforeEach(() => useSyncStore.setState({ pending: 0, startup: false }));

  it("counts a write until the server confirms it", async () => {
    let confirm!: () => void;
    const write = trackWrite(new Promise<void>((r) => (confirm = r)));
    expect(useSyncStore.getState().pending).toBe(1);
    confirm();
    await write;
    expect(useSyncStore.getState().pending).toBe(0);
  });

  it("stops counting a refused write and still passes the error on", async () => {
    const write = trackWrite(Promise.reject(new Error("refused")));
    await expect(write).rejects.toThrow("refused");
    await Promise.resolve();
    expect(useSyncStore.getState().pending).toBe(0);
  });

  it("marks earlier edits as on their way until they are sent", async () => {
    let sent!: () => void;
    trackStartupWrites(new Promise<void>((r) => (sent = r)));
    expect(useSyncStore.getState().startup).toBe(true);
    sent();
    await new Promise((r) => setTimeout(r));
    expect(useSyncStore.getState().startup).toBe(false);
  });

  it("words the state for online and offline", () => {
    expect(syncStatus({ pending: 0, startup: false }, false)).toBe("saved");
    expect(syncStatus({ pending: 2, startup: false }, true)).toBe("saving");
    expect(syncStatus({ pending: 0, startup: true }, false)).toBe("waiting");
  });
});
