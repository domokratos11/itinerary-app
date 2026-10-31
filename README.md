# itinerary-app

A personal itinerary app for our Japan trip (Dec 2026 – Jan 2027), built with Next.js + shadcn/ui and published as a static site on GitHub Pages:
https://domokratos11.github.io/itinerary-app/

```bash
npm install
npm run dev        # http://localhost:3000/itinerary-app/
npm run test
npm run validate
npm run build      # static export in out/
```

Project rules for Claude Code are in [CLAUDE.md](CLAUDE.md).

## After changing firestore.rules

The app reads and writes the trip in Firestore. When `firestore.rules`
changes, paste it into Firebase console → Firestore → Rules and Publish;
until then, edits to the new parts are refused. Nothing about a trip is
bundled with the app: what you see is what Firestore has.

The trip ID stays out of the repo. See Security setup below for who can
open a trip.

## Security setup

The trip opens only for people who sign in with Google **and** whose
email is on the trip's member list. A leaked link alone shows nothing.
One-time steps in the [Firebase console](https://console.firebase.google.com/):

1. **Turn on Google sign-in:** Authentication → Sign-in method → Google →
   Enable.
2. **Allow the site:** Authentication → Settings → Authorized domains →
   add `domokratos11.github.io` (`localhost` is there already).
3. **Add the members:** Firestore → `trips/<your trip id>` → add a field
   `members` of type _array_, with one lowercase email per entry. The
   emails stay in Firestore, never in the repo. Add or remove people
   here at any time.
4. **Publish the rules:** paste `firestore.rules` into Firestore → Rules
   and Publish. Do step 3 first, or everyone is locked out until you do.
5. **App Check (recommended):** it makes Firestore accept requests only
   from this app, not from scripts that copy its config.
   - Create a reCAPTCHA v3 key for `domokratos11.github.io` and
     `localhost` at <https://www.google.com/recaptcha/admin>.
   - App Check → Apps → your web app → reCAPTCHA → paste the _secret_
     key. Put the _site_ key in `appCheckSiteKey` in
     `src/lib/firebase.config.ts` and deploy.
   - On `npm run dev` the browser console prints an App Check debug
     token; register it under App Check → Apps → Manage debug tokens.
   - Watch App Check → Firestore for a few days. When the requests show
     as verified, press **Enforce**.
6. **Stay on the Spark plan.** It can never be billed. If you ever move
   to Blaze, set a budget alert in Google Cloud → Billing first.

**Scripts** (`queue:pull`, `places:push`) skip the rules through
the Admin SDK and use your own Google Cloud login. Run this once per
machine (needs the [gcloud CLI](https://cloud.google.com/sdk/docs/install)):

```bash
gcloud auth application-default login
```

Signing out (Settings → Account) removes the trip's offline copy from
that device.
