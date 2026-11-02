import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

import { appCheckSiteKey, firebaseConfig } from "@/lib/firebase.config";
import { isViewer } from "@/lib/viewer-store";

let db: Firestore | undefined;
let viewerDb: Firestore | undefined;

declare global {
  // Read by App Check: true makes it print a debug token to register.
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined;
}

// Browser only, like everything below. App Check starts with the app so
// every Firestore and Auth request carries its token.
function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  const app = initializeApp(firebaseConfig);
  if (appCheckSiteKey) {
    // reCAPTCHA can't vouch for localhost: the dev server uses a debug
    // token instead, printed in the console the first time.
    if (location.hostname === "localhost")
      globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  return app;
}

// Browser only: call from an effect or event handler, never at module load,
// so the static build does not touch IndexedDB. The local cache keeps the
// plan readable and queues edits while offline.
export function getDb(): Firestore {
  // Someone on a read-only link never reaches the trip itself, so no screen
  // can read or write it by mistake; the rules would refuse them anyway.
  if (isViewer()) throw new Error("Read-only link");
  if (db) return db;
  db = initializeFirestore(getFirebaseApp(), {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  return db;
}

// For people opening a read-only link: a separate app with no sign-in and
// a memory cache, so the copy never stays on their device and a closed link
// can't be read back from an offline cache.
export function getViewerDb(): Firestore {
  if (viewerDb) return viewerDb;
  const name = "viewer";
  const app =
    getApps().find((a) => a.name === name) ??
    initializeApp(firebaseConfig, name);
  viewerDb = initializeFirestore(app, { localCache: memoryLocalCache() });
  return viewerDb;
}

// The signed-in user is kept in IndexedDB, so sign-in survives reloads and
// works offline.
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}
