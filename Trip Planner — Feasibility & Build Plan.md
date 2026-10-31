# Trip Planner — Feasibility & Build Plan

Oct 28, 2026 · @Reynaldo

## Summary and verdict

Feasible at $0, with no credit card on file anywhere. The app is a static site on GitHub Pages; each city's places are JSON files in the repo; the shared day plan lives in a Firebase Firestore database on the free Spark plan; every place and route opens in Google Maps through plain links.

What changed in this revision:

- **No Google Maps integration.** No embedded map, no Google Cloud project, no API key. Places and directions are Google Maps links that open the Maps app.
- **Open editing by link.** Anyone with the link can view and edit. Protection comes from an unguessable trip ID in the link and Firestore rules that only allow that one trip, not from logins.
- **Built with Claude Code.** Each build step below carries the prompt to give Claude Code, and a separate section lists the manual setup only you can do.

Time is the main constraint: the trip starts Dec 15, 2026, so the MVP targets Nov 30 on both phones. Attach the V3 city JSON files (`claude/v3/0[1-5]_*.json`) to the repo before the data step so nothing gathered so far is retyped.

## Requirements as understood

The tool is a personal Wanderlog without the embedded map: a catalog of places per city, a calendar of trip days, a way to move places onto days, and a day view to use on the ground. Cities follow the V3 route: Tokyo-Ueno (Dec 17-24), Nagoya (Dec 24-27), Hiroshima (Dec 27-30), Osaka (Dec 30-Jan 4, Kobe day trip), Kawaguchiko (Jan 4-5), Tokyo-Asakusa (Jan 5-12).

| Feature | What it means here | Phase |
| --- | --- | --- |
| City place lists | One list per city stay, built from Google Maps links you collect | MVP (by Dec 1) |
| Place card | Name, Maps link, category, purpose, description, tips, cost, typical duration, researched opening hours, nearby saved places | MVP (by Dec 1) |
| Trip calendar | Days Dec 17-Jan 12 generated from the stays; each day knows its city and hotel | MVP (by Dec 1) |
| Assign to a day | "Add to day" picker on phone; drag and drop on desktop/tablet | MVP (by Dec 1) |
| Reorder and move | Reorder within a day, move between days, send back to the city's unassigned ("doesn't fit") list | MVP (by Dec 1) |
| Today view | Opens on the current date in Japan time: stops in order, times, notes, hotel | MVP (by Dec 1) |
| Next-stop link | One tap opens Google Maps with transit directions to the next stop | MVP (by Dec 1) |
| Full-day route | Leg-by-leg links, hotel to stops to hotel | MVP (by Dec 1) |
| Shared plan | Anyone with the link sees and edits the same plan; changes sync between phones | MVP (by Dec 1) |
| Reservations | Flights, hotels, shinkansen, tours, Disney as cards on their dates | Phase 2 (before trip) |
| Opening-hours warnings | Flag a stop on a day it's closed, including New Year closures | Phase 2 (before trip) |
| Offline mode | Plan readable without signal (installable app) | Phase 2 (before trip) |
| Day cost estimate | Sum of estimated costs per day and per city | Phase 2 (before trip) |
| Distance between stops | Straight-line distance from saved coordinates, as a rough guide | Phase 2 (before trip) |
| Suggest order | Proposes a shorter order for a day's stops | Phase 3 (later) |
| Add place in-app | Paste a Maps link in the app; Claude Code enriches it later | Phase 3 (later) |
| Expenses and checklists | Actual spend tracking, packing list | Phase 3 (later) |

On phones the "Add to day" picker is the primary interaction; drag and drop is the convenience on bigger screens.

## Key constraints

Five constraints shape the design; each has a simple answer.

1. **Static hosting is read-only.** GitHub Pages only serves files; a phone can't write back to it.
   - Answer: the editable plan goes to Firestore; the place catalog stays as files.
2. **Public repo, public link.** On GitHub's free plan, Pages only publishes from public repositories ([GitHub docs](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)), so the code and the city files are visible to anyone who finds the repo.
   - Answer: the trip ID lives only in the link you share, never in the repo. Firestore rules contain no secret: they allow reading and editing a trip only by its exact ID, and forbid listing, creating or deleting trips. Keep hotel confirmation numbers out of the repo.
3. **No undo for open editing.** Anyone with the link can move or delete things by accident.
   - Answer: soft delete (items are marked removed, not erased), an "Export plan" backup button, and a recent-changes list in the app.
4. **Connectivity in Japan.** Subways and Kawaguchiko will have gaps.
   - Answer: an installable app that caches itself and the plan; Firestore's offline cache queues edits and syncs when back online.
5. **Place facts are researched, not live.** With no Google API, hours and prices come from Claude Code's research of official sites, and can change.
   - Answer: each place stores `verifiedAt`; the Maps link is always one tap away to confirm, and holiday closures (Dec 29-Jan 3) get their own `closedDates` field.

## Persistence: where edits live

Firestore is the right fit, because "anyone with the link edits" rules out the GitHub-commit option: committing from the browser needs a GitHub token on every device that edits.

| Option | Anyone with the link edits | Offline | Setup | Fit |
| --- | --- | --- | --- | --- |
| Firestore (Spark) | Yes, live sync between phones | Built-in cache, queued edits | One Firebase project, no card | Recommended |
| GitHub as storage | Only devices holding a token | Read-only | Token pasted on each phone | No |
| Browser storage only | No, each phone has its own plan | Yes | None | Prototype only |

How it splits:

- **Catalog (files in the repo):** cities, places, stays, reservations. Curated with Claude Code, deployed with the app.
- **Plan (Firestore):** one trip document plus one document per scheduled stop (place, date, order, time, note, status).
- **Backup to files:** "Export plan" downloads the plan as JSON, which you can commit next to the city files so the files stay the trip's documentation.
- **Swappable storage:** screens talk to a small `PlanRepository` interface; a local-storage version doubles as the offline fallback and makes testing easy.

## What it costs

$0, and nothing in this setup can charge you: no account involved has a payment method on file.

| Service | Plan | Card needed | What happens at the limit | Your expected use |
| --- | --- | --- | --- | --- |
| GitHub repo + Pages | Free, public repo | No | Site limit 1 GB | A few MB |
| GitHub Actions (build and deploy) | Free for public repos on standard runners ([GitHub docs](https://docs.github.com/en/billing/concepts/product-billing/github-actions)) | No | Not applicable for public repos | About 1-2 minutes per deploy |
| Firebase Firestore | Spark: 50,000 reads, 20,000 writes per day, 1 GiB stored ([Firebase docs](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)) | No | Requests fail until the daily quota resets; never billed | Roughly 3,000 reads and under 300 writes a day |
| Google Maps | Links only, no API | No | None | Unlimited |
| Claude Code | Your existing Claude plan | Already set | Normal plan usage limits | Build sessions only |

The one rule that keeps it free: never upgrade the Firebase project to the Blaze plan, which is the only step that attaches a billing account. The read estimate assumes 2 people opening the app about 10 times a day with around 150 scheduled stops; the offline cache lowers it further.

## Recommended stack

A Next.js app (React, App Router) styled with shadcn/ui, built by Claude Code as a static export and hosted on GitHub Pages, with Firestore as the only service it talks to.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js App Router with `output: 'export'` | Same stack you want to learn; `next build` writes plain HTML/JS files to `out/`, which GitHub Pages can serve |
| Language | TypeScript | One typed model shared by the app and the data scripts |
| UI components | shadcn/ui (Radix + Tailwind) | Card, Sheet, Drawer, Dialog, Tabs, Badge, Command and Sonner cover every screen; components live in your repo, editable |
| Styling | Tailwind CSS (set up by shadcn) | Mobile-first layout, dark mode for free |
| Drag and drop | dnd-kit | Touch and keyboard sensors, sortable lists across days |
| State | Zustand | A small store fed by the Firestore listener |
| Routing | `/city/[cityId]` and `/day/[date]` pre-generated with `generateStaticParams`; trip ID in `?trip=` | Cities and dates are known at build time; the trip ID is read in the browser |
| Dates | date-fns + date-fns-tz | "Today" computed in Asia/Tokyo time, not El Salvador time |
| Plan storage | Firebase JS SDK, Firestore with persistent local cache, Client Components only | Live sync, offline edits |
| Offline | Web manifest + Workbox service worker generated over `out/` | Installable on both phones; app and catalog cached |
| Google Maps | Maps URLs (plain links) | Place pages and transit directions in the Maps app; no key |
| Hosting and CI | GitHub Pages + GitHub Actions | Deploy on every push to `main` |
| Data scripts | Node + tsx + Zod | Validate every city file; migrate the V3 files |
| Tests | Vitest + React Testing Library | Day derivation, ordering, closed-day checks, key components |

**What static export rules out.** Server Actions, middleware, request-reading Route Handlers, ISR, default image optimization, and dynamic routes without `generateStaticParams` don't work in a static export ([Next.js docs](https://nextjs.org/docs/app/guides/static-exports)). Nothing in this app needs them: the build pre-renders the catalog pages, and the plan is loaded in the browser from Firestore. Set `basePath: '/japan-trip-planner'`, `trailingSlash: true` and `images.unoptimized: true` for GitHub Pages.

The Firebase config object (apiKey, projectId and so on) is shipped in the app's code. That's expected and safe: it identifies the project, it isn't a password; access is decided by the Firestore rules.

How the parts connect:

&#91;embedded content: architecture · build time above, runtime below\]

Claude Code turns your links into city JSON in the repo, which deploys with the app; at runtime the phones only write the plan to Firestore and hand routes to the Google Maps app.

## Data model

Four kinds of records live in files and one in Firestore; days are computed from stays, never stored.

| Entity | Lives in | Key fields |
| --- | --- | --- |
| City | `data/cities.json` | id (`tokyo-ueno`), name, color |
| Place | `data/places/<city>.json` | id, cityId, mapsUrl, name, lat, lng, category, purpose, description, tips, costEstimateJPY, durationMin, openingHours, closedDates, seasonFrom/To, priority, verifiedAt |
| Stay | `data/trip.json` | cityId, hotelName, hotelMapsUrl, lat, lng, checkIn, checkOut |
| Reservation | `data/trip.json` | type (flight, train, hotel, tour, ticket), date, time, from, to, note (no confirmation numbers) |
| Plan item | Firestore `trips/{tripId}/items/{itemId}` | placeId, date, order, startTime, durationMin, note, status (planned, done, skipped, removed), updatedAt |

Design decisions worth keeping:

- **Days are derived.** A day belongs to the stay whose check-in to check-out range contains it. Transfer days (Dec 24, Dec 27, Dec 30, Jan 4, Jan 5) belong to two cities, so the picker shows both lists.
- **Coordinates come from the link.** A full Google Maps URL contains `@lat,lng`; the data step reads them so the app can show distances and "nearby saved places" without any API.
- **Order uses fractional keys** (`a0`, `a0V`, `a1`), so moving a stop rewrites one document.
- **Unassigned = "doesn't fit".** A place with no active plan item is unassigned in its city.
- **Soft delete.** Removing a stop sets `status: removed`; the app hides it and can restore it.

Example place entry:

```json
{
  "id": "nagoya-oasis21",
  "cityId": "nagoya",
  "mapsUrl": "https://maps.app.goo.gl/...",
  "name": "Oasis 21",
  "lat": 35.1709,
  "lng": 136.9100,
  "category": "lights",
  "purpose": "Evening walk on the lit glass roof deck next to the TV Tower",
  "tips": ["Go after dark", "Combine with Sakae shopping"],
  "costEstimateJPY": 0,
  "durationMin": 45,
  "openingHours": "Roof deck 10:00-21:00 (verify)",
  "closedDates": [],
  "priority": "want",
  "verifiedAt": "2026-10-28"
}
```

Values in the example are placeholders to show the shape; the data step fills real ones.

## Gathering place data from your links

You paste links; Claude Code turns each one into a complete place entry. With no Google API, the name and coordinates come from the link itself and everything else from researching official and travel sites.

1. **Collect links.** One text file per city, one link per line, optional note after a `#`: `links/nagoya.txt`.
2. **Resolve each link.** Claude Code follows the `maps.app.goo.gl` redirect from your machine; the full URL carries the place name and `@lat,lng`. Links it can't resolve are listed for you to fix.
3. **Research and write.** Claude Code looks up the place (official site first), then fills purpose, description, tips, cost, typical duration, opening hours, seasonal window and holiday closures, in its own words, with `verifiedAt` set and uncertain facts marked "(verify)".
4. **Validate and review.** The Zod check runs on every file; you review the diff and commit; GitHub Actions deploys.

"Nearby" is computed in the app: other saved places within about 1 km of the one you're looking at, using the stored coordinates. The V3 city files get a one-time migration into this format first, so only new links need the full research pass.

## Routes, all through Google Maps links

Every route feature is a [Maps URL](https://developers.google.com/maps/architecture/maps-url) built from saved coordinates: free, no key, and it opens the Google Maps app on the phone with live transit times.

| Feature | Link the app builds |
| --- | --- |
| Open a place | The saved `mapsUrl` |
| Go to next stop from where I am | `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=transit` (no origin = your current location) |
| One leg (stop A to stop B) | Same, plus `&origin=<lat>,<lng>` of stop A |
| Full day | A list of leg links: hotel, stop 1, stop 2 … back to the hotel (or on to the next hotel on transfer days) |
| Walking overview of the day | One link with `&waypoints=` joined by `\|` and `travelmode=walking`, for compact areas |

The day view also shows the straight-line distance between consecutive stops as a hint ("1.2 km"); real times come from Maps when you tap. Transit directions don't accept intermediate stops ([Directions docs](https://developers.google.com/maps/documentation/javascript/directions)), which is why the full day is a chain of legs rather than one train route.

## Manual configuration (only you can do this)

You need three accounts and no keys: GitHub, a Google account for Firebase, and Claude Code. Nothing here asks for a card.

**On your computer**

1. Install Git and Node.js LTS.
2. Install Claude Code and sign in with your Claude account.

**GitHub (hosting)**

1. Create a **public** repository, e.g. `japan-trip-planner` (free Pages requires public).
2. Clone it, put the V3 city files in a `legacy/` folder, and open Claude Code in that folder.
3. After Claude Code pushes the first deploy workflow: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Your site URL becomes `https://<your-user>.github.io/japan-trip-planner/`. No secrets or tokens are needed; the workflow uses GitHub's built-in deploy permission.

**Firebase (the shared plan)**

1. Go to the Firebase console, **Add project**, name it, turn off Google Analytics. It starts on the free Spark plan; never click "Upgrade".
2. **Build → Firestore Database → Create database.** Location: `asia-northeast1 (Tokyo)` (can't be changed later). Start in **production mode** (test mode silently locks after 30 days).
3. **Project settings → General → Your apps → Web (`</>`)**, register an app called `trip-planner`, skip Firebase Hosting, and copy the `firebaseConfig` object. You'll paste it into a Claude Code prompt; it's not a secret.
4. **Firestore → Rules**: paste the `firestore.rules` file Claude Code writes, then **Publish**.
5. **Firestore → Data → Start collection** `trips`, click **Auto-ID** for the document ID, and add fields `name` (string) and `startDate`, `endDate` (strings, `2026-12-17`, `2027-01-12`). That Auto-ID is your trip ID.
6. Share `https://<your-user>.github.io/japan-trip-planner/?trip=<tripId>` with Karla only.

**On both phones**

1. Open the link in Safari (iPhone) or Chrome (Android).
2. **Share → Add to Home Screen** (iPhone) or **menu → Install app** (Android), so it opens offline.

**Keep an eye on**

- Firebase **Firestore → Usage** shows daily reads and writes against the free limits.

## Build plan with Claude Code prompts

Nine prompts take the project from an empty repo to a deployed app; the MVP is done after prompt 6 (target Nov 30). For each prompt: start in plan mode, read the plan, approve, then commit once tests and validation pass.

### Phase 0 — Skeleton and deploy (Oct 29-Nov 2)

Before: GitHub repo created and cloned, V3 files in `legacy/`.

**Prompt 1 — scaffold, CLAUDE.md, deploy**

```text
Create a Next.js (App Router) + React + TypeScript project in this repo for a personal trip planner (a Wanderlog-like itinerary app, no embedded map).

Configure it as a static export for GitHub Pages in next.config: output 'export', basePath '/japan-trip-planner', trailingSlash true, images unoptimized. No server features: no Server Actions, no middleware/proxy, no Route Handlers that read the request, no ISR; every dynamic route must have generateStaticParams.

Set up Tailwind CSS and shadcn/ui with its CLI, and add these components: button, card, badge, sheet, drawer, dialog, tabs, select, command, sonner, scroll-area, separator, toggle-group. Add Vitest with React Testing Library, ESLint and Prettier.

Add a GitHub Actions workflow that runs tests, runs next build on every push to main, uploads the out/ folder with actions/upload-pages-artifact and deploys with actions/deploy-pages. Add an empty .nojekyll file to the output.

Write a CLAUDE.md with these standing rules:
- Next.js static export only; anything needing a server is not allowed.
- Use shadcn/ui components first; build custom components only when shadcn has no fit.
- Components that use browser APIs, Firestore or Zustand are Client Components ('use client'); keep pages as Server Components that pass build-time data down.
- No Google Maps API, SDK or key. Google Maps is used only through plain Maps URLs.
- Catalog data lives in data/*.json and is validated with Zod (npm run validate).
- The editable plan lives in Firestore under trips/{tripId}/items, accessed only through a PlanRepository interface.
- "Today" and all trip dates are computed in Asia/Tokyo time.
- Mobile-first: design for a 390px-wide screen first.
- Never commit hotel confirmation numbers or personal IDs.
- Before finishing any task, run npm run test, npm run validate and npm run build.

Show a placeholder home page using a shadcn Card, push, and tell me when the workflow is ready so I can switch Pages to GitHub Actions.
```

After: Settings → Pages → Source: GitHub Actions; confirm the placeholder loads on your phone.

### Phase 1 — Data (Nov 2-9)

**Prompt 2 — schema, trip file, migration**

```text
Define the data model in src/domain as TypeScript types plus Zod schemas:
- City: id, name, color
- Place: id, cityId, mapsUrl, name, lat, lng, category (lights | food | shopping | sight | daytrip | temple), purpose, description, tips[], costEstimateJPY, durationMin, openingHours, closedDates[], seasonFrom?, seasonTo?, priority (must | want | maybe), verifiedAt, notes?
- Stay: cityId, hotelName, hotelMapsUrl?, lat?, lng?, checkIn, checkOut
- Reservation: type (flight | train | hotel | tour | ticket), date, time?, from?, to?, note?
- PlanItem: id, placeId, date, order, startTime?, durationMin?, note?, status (planned | done | skipped | removed), updatedAt

Create data/cities.json with: tokyo-ueno, nagoya, hiroshima, osaka, kawaguchiko, tokyo-asakusa.

Create data/trip.json with these stays:
- tokyo-ueno: APA Hotel Ueno Eki Minami, 2026-12-17 to 2026-12-24
- nagoya: KOKO Hotel Nagoya Marunouchi, 2026-12-24 to 2026-12-27
- hiroshima: hotel to be decided, 2026-12-27 to 2026-12-30
- osaka: Tokyu REI Hotel Osaka, 2026-12-30 to 2027-01-04 (Kobe day trip on 2027-01-03)
- kawaguchiko: Plaza Inn Kawaguchiko, 2027-01-04 to 2027-01-05
- tokyo-asakusa: APA Hotel Asakusa Kuramae Kita, 2027-01-05 to 2027-01-12
and these reservations:
- 2026-12-15 flight SAL-LAX Volaris
- 2026-12-16 flight LAX-HND United UA 39, lands 2026-12-17
- 2027-01-12 21:05 flight HND-LAX ANA NH 126
- 2027-01-12 23:54 flight LAX-SAL Volaris
Do not add confirmation numbers.

Add npm run validate to check every file in data/. Then read the files in legacy/ and write scripts/migrate-v3.ts that converts them into data/places/<cityId>.json. Kobe places go into osaka with a "Kobe day trip" tag in notes. Put anything that doesn't map into notes and give me a report of what was dropped or guessed.
```

**Prompt 3 — enrich links (run once per city)**

```text
Process links/nagoya.txt (one Google Maps link per line, optional note after #).
For each link:
1. Resolve short links by following redirects with curl and read the place name and @lat,lng from the final URL. List any link you can't resolve and skip it.
2. If data/places/nagoya.json already has this place (same mapsUrl or same name), update it instead of adding a duplicate.
3. Research the place on the web, official sites first, and fill: category, purpose (one line: why we'd go), description (2-3 sentences in your own words), tips, costEstimateJPY, durationMin, openingHours, closedDates for our stay (2026-12-24 to 2026-12-27) and New Year (2026-12-29 to 2027-01-03), seasonFrom/seasonTo for illuminations or seasonal events, priority 'want' unless I noted otherwise.
4. Mark anything uncertain with "(verify)" and set verifiedAt to today.
Our priorities: winter illuminations, food, shopping and new sights; temples and shrines are low priority; no sumo.
Run npm run validate and finish with a table of places added or updated and anything that needs my check.
```

Repeat with each city's file and dates.

### Phase 2 — MVP app (Nov 9-30)

Before prompt 4: Firebase project and Firestore database created, web app registered, config copied.

**Prompt 4 — Firestore plan storage and rules**

```text
Add the Firebase JS SDK with Firestore only (no Auth, no Analytics). Put this config in src/lib/firebase.config.ts:
<paste firebaseConfig here>
Initialize Firebase only in the browser (Client Components) and enable Firestore persistent local cache with multi-tab support.

The trip ID comes from the ?trip= query parameter (read with useSearchParams inside a Suspense boundary) and is remembered in localStorage, so the installed app reopens the same trip. Every internal link keeps the ?trip= parameter.

Implement the PlanRepository interface with:
- FirestorePlanRepository: collection trips/{tripId}/items, one onSnapshot listener per trip feeding a Zustand store, fractional-indexing keys for order, soft delete by setting status 'removed'.
- LocalPlanRepository backed by memory for tests.

Write firestore.rules:
- trips/{tripId}: allow get; deny list, create, update, delete.
- trips/{tripId}/items/{itemId}: allow read only if the parent trip document exists; allow create and update only if the parent exists and the data has exactly the PlanItem fields with the right types and short string lengths; deny delete.
- Everything else denied.
Add tests for the repository logic, then print the rules file so I can paste it into the Firebase console.
```

After: paste and publish the rules, create the `trips` document with Auto-ID, open the site with `?trip=<tripId>`.

**Prompt 5 — catalog and calendar**

```text
Build these mobile-first screens with shadcn/ui components:
1. / — trip home: the days 2026-12-17 to 2027-01-12 as Cards, each with its city (two cities on transfer days) and number of stops; a "Today" button that jumps to today's date in Asia/Tokyo time, defaulting to 2026-12-17 before the trip.
2. /city/[cityId] — the city's catalog (generateStaticParams from data/cities.json) with Tabs or a ToggleGroup for category, a Select for priority and a switch for "unassigned only".
3. Place details in a Drawer on phones and a Sheet on wider screens: all fields as Badges and text, an "Open in Google Maps" Button using mapsUrl, and "Nearby saved places" within 1 km by straight-line distance.
The catalog pages are Server Components reading data/*.json at build time; plan counts come from the client-side store.
Derive days from the stays in data/trip.json. Add Vitest tests for day derivation, including transfer days.
```

**Prompt 6 — planning: assign, reorder, day view, links**

```text
Add planning:
- An "Add to day" Button on each place that opens a Drawer (phone) or Command palette (desktop) listing the days its city covers.
- A day page /day/[date] (generateStaticParams for every trip date) listing stops in order as Cards with optional start time, duration and note, plus reservations from data/trip.json on that date.
- Reorder and move between days with dnd-kit (touch and pointer sensors) on screens 768px and wider; up/down and a "Move to…" Select on phones.
- Remove = soft delete with a Sonner toast offering Undo; a "Recently changed" Sheet sorted by updatedAt.
- Hotel as first and last stop of each day; on transfer days start at the previous hotel and end at the next.
- Between stops: straight-line distance and a "Directions" Google Maps URL (travelmode=transit, origin = previous stop).
- A "Go to next stop" Button that opens directions with no origin (uses current location).
- A "Full day" Sheet listing every leg as a link.
All writes go through PlanRepository. Then push, wait for the deploy, and confirm the live URL works with ?trip=.
```

After: install the app on both phones and plan one real day together.

### Phase 3 — Before departure (Dec 1-14)

**Prompt 7 — offline, warnings, costs, export**

```text
Make the app installable and offline-capable without server features:
- A web app manifest (app/manifest.ts with dynamic = 'force-static') with icons and the GitHub Pages basePath as start_url and scope.
- A service worker generated over out/ with workbox-cli (generateSW) as a post-build step, caching the exported pages, _next assets and data JSON; register it from a small Client Component.
- An offline banner, and a check that edits made offline sync after reconnecting.
Add a warning Badge on stops scheduled on one of the place's closedDates or outside its season, and an estimated cost total per day and per city.
Add "Export plan", which downloads the full plan for the trip as JSON in the same shape as PlanItem.
```

**Prompt 8 — phone review pass**

```text
Review the whole app as a tester on a 390px-wide phone screen, in light and dark mode: list bugs, confusing flows and slow screens, fix them, run tests and validation, and summarize what changed.
```

After: airplane-mode test on both phones; export the plan and commit it to `data/plan-export.json`.

### Phase 4 — Later

**Prompt 9 — pick one at a time**

```text
Add <one of: a suggested stop order for a day (nearest neighbor from the hotel, shown as a suggestion I accept) | pasting a Google Maps link in the app to queue a place for the next enrichment run | an expenses log per day | a packing checklist>. Follow CLAUDE.md, add tests, and keep the phone layout first.
```

## Risks and open questions

The biggest risk is schedule, not cost or technology: if the app isn't solid by Dec 14, the existing infographic remains the fallback.

| Risk | Mitigation |
| --- | --- |
| MVP not ready before departure | Strict cut after prompt 6; Phase 3 is optional |
| Link leaks to a stranger | Only the trip ID grants access; create a new trip document and stop sharing the old ID |
| Accidental edits or removals | Soft delete with undo, recent-changes list, regular plan exports |
| Wrong hours or closures | `verifiedAt`, "(verify)" marks, Maps link one tap away; recheck closures the week before |
| Free quota hit | Requests pause until the next day's reset; no charge, and the offline cache keeps the plan readable |
| A short link that won't resolve | Claude Code lists it; paste the full Maps URL instead |

Open questions:

- [ ] Does this app replace the infographic, or should the infographic keep being generated from the same files?
- [ ] Hiroshima hotel (Dec 27-30) is still open; update `data/trip.json` once booked.

## Sources

- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)

* [GitHub Pages availability by plan](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)
* [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
* [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
* [Google Maps URLs](https://developers.google.com/maps/architecture/maps-url)
* [Directions service (transit and waypoints)](https://developers.google.com/maps/documentation/javascript/directions)
