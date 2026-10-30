import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { clearIndexedDbPersistence, terminate } from "firebase/firestore";

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
  try {
    await signInWithPopup(getFirebaseAuth(), provider);
    return true;
  } catch (error) {
    const code = error instanceof FirebaseError ? error.code : "";
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    )
      return false;
    throw new Error(SIGN_IN_ERRORS[code] ?? "Sign-in failed. Try again.");
  }
}

const SIGN_IN_ERRORS: Record<string, string> = {
  "auth/popup-blocked":
    "The browser blocked the sign-in window. Allow pop-ups for this site and try again.",
  "auth/unauthorized-domain":
    "This site isn't allowed to sign in yet. Add it under Firebase → Authentication → Settings → Authorized domains.",
  "auth/operation-not-allowed":
    "Google sign-in is turned off. Enable it under Firebase → Authentication → Sign-in method.",
  "auth/network-request-failed": "No connection. Sign in once you're online.",
};

// Also wipes the trip from this device's offline cache, then reloads so
// nothing from the old session stays in memory. Edits not yet synced are
// lost, so callers should say so.
export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
  const db = getDb();
  await terminate(db);
  await clearIndexedDbPersistence(db);
  window.location.reload();
}
