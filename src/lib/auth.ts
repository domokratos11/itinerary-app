import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  clearIndexedDbPersistence,
  terminate,
  waitForPendingWrites,
} from "firebase/firestore";

import type { MessageKey } from "@/domain/i18n";
import { t } from "@/lib/i18n";
import { getDb, getFirebaseAuth } from "@/lib/firebase";

export type SignedInUser = {
  uid: string;
  email: string | null;
  name: string | null;
};

// Calls back with the current user now and after every sign-in or out.
export function watchUser(
  onUser: (user: SignedInUser | null) => void,
): () => void {
  return onAuthStateChanged(getFirebaseAuth(), (user) =>
    onUser(
      user
        ? { uid: user.uid, email: user.email, name: user.displayName }
        : null,
    ),
  );
}

// A popup, not a redirect: the redirect flow needs the auth domain to be
// the site's own, and GitHub Pages isn't.
// Resolves false when the person closes the popup; other failures throw
// an Error worded for the screen.
export async function signInWithGoogle(): Promise<boolean> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  // From the home-screen app on iPhone the popup sometimes never reports
  // back. Stop waiting, so the button can be tapped again; if the popup does
  // finish later, the sign-in still counts.
  const gaveUp = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new SignInTimeout(t("auth.timeout"))),
      SIGN_IN_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([signInWithPopup(getFirebaseAuth(), provider), gaveUp]);
    return true;
  } catch (error) {
    if (error instanceof SignInTimeout) throw error;
    const code = error instanceof FirebaseError ? error.code : "";
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    )
      return false;
    throw new Error(t(signInErrorKey(code, isStandalone())));
  } finally {
    clearTimeout(timer);
  }
}

export const SIGN_IN_TIMEOUT_MS = 90_000;

class SignInTimeout extends Error {}

const SIGN_IN_ERRORS: Record<string, MessageKey> = {
  "auth/popup-blocked": "auth.popupBlocked",
  "auth/unauthorized-domain": "auth.unauthorizedDomain",
  "auth/operation-not-allowed": "auth.operationNotAllowed",
  "auth/network-request-failed": "auth.network",
  "auth/web-storage-unsupported": "auth.storageBlocked",
  "auth/too-many-requests": "auth.tooMany",
  "auth/user-disabled": "auth.disabled",
};

// Failures that, in the home-screen app, usually mean the popup couldn't
// reach back to it; a fresh start of the app tends to fix them.
const STANDALONE_RETRY = new Set([
  "auth/popup-blocked",
  "auth/web-storage-unsupported",
  "auth/internal-error",
]);

export function signInErrorKey(code: string, standalone: boolean): MessageKey {
  if (standalone && STANDALONE_RETRY.has(code)) return "auth.standaloneRetry";
  return SIGN_IN_ERRORS[code] ?? "auth.failed";
}

// True when the app was opened from the home screen rather than a browser
// tab. iOS reports it through navigator.standalone, others through CSS.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;
  return (
    iosStandalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

// Signs out and wipes the trip from this device's offline cache. Edits not
// yet synced are lost, so callers should say so.
async function endSession(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
  const db = getDb();
  await terminate(db);
  await clearIndexedDbPersistence(db);
}

// Reloads so nothing from the old session stays in memory.
export async function signOut(): Promise<void> {
  await endSession();
  window.location.reload();
}

const PENDING_WRITES_MS = 5000;

// For a new version: gives unsynced edits a moment to upload first.
export async function clearSession(): Promise<void> {
  await Promise.race([
    waitForPendingWrites(getDb()),
    new Promise((resolve) => setTimeout(resolve, PENDING_WRITES_MS)),
  ]);
  await endSession();
}
