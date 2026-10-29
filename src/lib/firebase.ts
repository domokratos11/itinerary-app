import { getApp, getApps, initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

import { firebaseConfig } from "@/lib/firebase.config";

let db: Firestore | undefined;

// Browser only: call from an effect or event handler, never at module load,
// so the static build does not touch IndexedDB. The local cache keeps the
// plan readable and queues edits while offline.
export function getDb(): Firestore {
  if (db) return db;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  return db;
}
