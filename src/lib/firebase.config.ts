// Firebase web config. This identifies the project; it is not a password.
// Access is decided by firestore.rules, not by this object.
export const firebaseConfig = {
  apiKey: "AIzaSyA-0re_jCK-BqkZUAUSM4j9p-eq7KAI4HA",
  authDomain: "itinerary-f990b.firebaseapp.com",
  projectId: "itinerary-f990b",
  storageBucket: "itinerary-f990b.firebasestorage.app",
  messagingSenderId: "176033560300",
  appId: "1:176033560300:web:65c6893d89bb456ccf57c9",
};

// reCAPTCHA v3 site key for App Check. Public like the config above; null
// leaves App Check off. See README → Security setup.
export const appCheckSiteKey: string | null = null;
