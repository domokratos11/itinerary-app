/**
 * Firestore for the Node scripts, through the Admin SDK. The rules only let
 * signed-in members in, and a script can't sign in with Google, so the
 * scripts use your own Google Cloud login instead, which the rules don't
 * apply to. Run once per machine:
 *
 *   gcloud auth application-default login
 *
 * or point GOOGLE_APPLICATION_CREDENTIALS at a service-account key file
 * kept outside the repo.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { firebaseConfig } from "../src/lib/firebase.config";

export function adminDb(): Firestore {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
  return getFirestore(app);
}
