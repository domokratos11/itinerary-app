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

## Versions

The version shows on the sign-in screen, at the bottom of the sidebar and in
the account panel. It comes from git, so nothing is edited by hand: `main`
carries the tag `v1.0.0`, and each merge after it adds one to the last number
(1.0.1, 1.0.2, ...). For a new major or minor version, tag `main` (`v1.1.0`).

When a device finds a different version, it uploads unsynced edits, clears its
storage and caches, and asks for sign-in again. Language, theme and device name
stay. Without signal nothing is cleared. The account panel (the person icon in the header) can check by hand.

## Languages

The app is in English and Spanish, with all its text in `src/messages/`. Each
person's language is saved with their account and applied at sign-in; change it
on the sign-in screen or in the account panel. Your own data (place names,
notes) stays as you typed it, and activity entries stay in the language they
were written in. Google Maps itself stays in English.

## Security setup

The app shows nothing until someone signs in with Google, and a trip opens
only when their email is on its member list. A leaked link alone shows
nothing. After sign-in the app finds the person's trips by itself; with
several, it asks which one, and the name in the header switches between
them. **New trip** is in the same menu, and Settings → Trip changes a trip's
name and members.
One-time steps in the [Firebase console](https://console.firebase.google.com/):

1. **Turn on Google sign-in:** Authentication → Sign-in method → Google →
   Enable.
2. **Allow the site:** Authentication → Settings → Authorized domains →
   add `domokratos11.github.io` (`localhost` is there already).
3. **Say who can create trips:** Firestore → create the document
   `config/access` with a field `tripCreators` of type _array_, with one
   lowercase email per entry. Google sign-in accepts any account, so this
   stops strangers from creating trips. The emails stay in Firestore, never
   in the repo. Everyone else can only open trips they were added to.
4. **Publish the rules:** paste `firestore.rules` into Firestore → Rules
   and Publish.
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
