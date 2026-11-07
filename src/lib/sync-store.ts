import { create } from "zustand";

// Whether this device's edits have reached the server. Firestore keeps edits
// made offline and sends them later; its write promises settle only once the
// server has them, so counting the open ones counts what's still on the way.
type SyncState = {
  // Writes from this session that the server hasn't confirmed yet.
  pending: number;
  // True until edits queued in an earlier session (before a reload) are sent.
  startup: boolean;
};

export const useSyncStore = create<SyncState>()(() => ({
  pending: 0,
  startup: false,
}));

// Counts the write while it's open and hands back the same promise.
export function trackWrite<T>(write: Promise<T>): Promise<T> {
  useSyncStore.setState((s) => ({ pending: s.pending + 1 }));
  const done = () => useSyncStore.setState((s) => ({ pending: s.pending - 1 }));
  write.then(done, done);
  return write;
}

// Marks the edits left over from an earlier session as on their way until
// `sent` settles.
export function trackStartupWrites(sent: Promise<unknown>): void {
  useSyncStore.setState({ startup: true });
  const done = () => useSyncStore.setState({ startup: false });
  sent.then(done, done);
}

export type SyncStatus = "saved" | "saving" | "waiting";

export function syncStatus(
  { pending, startup }: SyncState,
  online: boolean,
): SyncStatus {
  if (pending === 0 && !startup) return "saved";
  return online ? "saving" : "waiting";
}
