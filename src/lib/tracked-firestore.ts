import {
  deleteDoc as firestoreDeleteDoc,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  waitForPendingWrites,
  writeBatch as firestoreWriteBatch,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type PartialWithFieldValue,
  type SetOptions,
  type UpdateData,
  type WithFieldValue,
  type WriteBatch,
} from "firebase/firestore";

import { getDb } from "@/lib/firebase";
import { trackStartupWrites, trackWrite } from "@/lib/sync-store";

// The Firestore writes the repositories use, counted by the sync store so
// the header can say whether everything has reached the server. Same
// signatures as firebase/firestore, so a repository only changes its import.

export function setDoc<A, D extends DocumentData>(
  reference: DocumentReference<A, D>,
  data: WithFieldValue<A>,
): Promise<void>;
export function setDoc<A, D extends DocumentData>(
  reference: DocumentReference<A, D>,
  data: PartialWithFieldValue<A>,
  options: SetOptions,
): Promise<void>;
export function setDoc<A, D extends DocumentData>(
  reference: DocumentReference<A, D>,
  data: PartialWithFieldValue<A>,
  options?: SetOptions,
): Promise<void> {
  return trackWrite(
    options
      ? firestoreSetDoc(reference, data, options)
      : firestoreSetDoc(reference, data as WithFieldValue<A>),
  );
}

export function updateDoc<A, D extends DocumentData>(
  reference: DocumentReference<A, D>,
  data: UpdateData<D>,
): Promise<void> {
  return trackWrite(firestoreUpdateDoc(reference, data));
}

export function deleteDoc<A, D extends DocumentData>(
  reference: DocumentReference<A, D>,
): Promise<void> {
  return trackWrite(firestoreDeleteDoc(reference));
}

export function writeBatch(db: Firestore): WriteBatch {
  const batch = firestoreWriteBatch(db);
  const commit = batch.commit.bind(batch);
  batch.commit = () => trackWrite(commit());
  return batch;
}

// Once per session, after sign-in: edits saved offline before a reload are
// still queued, and this session's own count can't see them.
export function watchStartupWrites(): void {
  trackStartupWrites(waitForPendingWrites(getDb()));
}
