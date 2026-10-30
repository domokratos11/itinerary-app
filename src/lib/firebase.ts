import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

import { appCheckSiteKey, firebaseConfig } from "@/lib/firebase.config";

let db: Firestore | undefined;

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
  if (db) return db;
  db = initializeFirestore(getFirebaseApp(), {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  return db;
}

// The signed-in user is kept in IndexedDB, so sign-in survives reloads and
// works offline.
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}
