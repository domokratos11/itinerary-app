# Itinerary app: standing rules

A personal trip planner for Japan, Dec 15, 2026 to Jan 12, 2027 (a Wanderlog-like itinerary). Next.js App Router + React + TypeScript, shadcn/ui, static export on GitHub Pages at `https://domokratos11.github.io/itinerary-app/`.

@AGENTS.md

## Rules

1. **Next.js static export only; anything needing a server is not allowed.** `next.config.ts` sets `output: 'export'`, `basePath: '/itinerary-app'` (must equal the repo name), `trailingSlash: true`, `images.unoptimized: true`. No Server Actions, no middleware/proxy, no Route Handlers that read the request, no ISR, no cookies/headers/redirects/rewrites. Every dynamic route must have `generateStaticParams` (and `dynamicParams = false`). Pages whose subject can change at runtime (days, cities) are one static page reading a query parameter instead (`/day/?date=`, `/city/?id=`).
2. **shadcn/ui components first.** Build a custom component only when shadcn has no fit. Components live in `src/components/ui`. Add new ones with `npx shadcn@latest add <name>`.
3. **Client vs Server Components.** Anything using browser APIs, Firestore or Zustand is a Client Component (`'use client'`). Pages stay Server Components that render the static shell; trip data comes from the client stores (`lib/trip-store`, `lib/plan-store`), with `useSearchParams` inside a `Suspense` boundary.
4. **Google Maps follows Google's storage terms.** See `docs/maps-and-research-plan.md`. Screens reach the Maps SDK and APIs only through the `MapsService` interface (`src/domain/maps-service.ts`); the SDK is one lazily added script tag, not a wrapper library. Store only place IDs (indefinitely) and Google coordinates (at most 30 days, refreshed by `maps:refresh`, never copied to the repo or backups). Hours, ratings, photos and route times or distances stay in memory. Google data appears only on a Google map or with the Google logo, never on another map provider. The browser key is public and restricted; the script key stays in the git-ignored `.env`. Google Cloud stays in its own projects, never billing on the Firebase project. Links out still use plain Maps URLs (`https://www.google.com/maps/search/?api=1&query=...`, `https://www.google.com/maps/dir/?api=1&...`).
5. **Firestore is the only source of the trip.** Cities, stays, reservations, places, holidays and expenses live under `trips/{tripId}/{cities,stays,reservations,places,holidays,expenses}`, the budget on the trip document, and nothing about a trip is bundled with the app: an empty collection shows as empty. Tests use in-memory repositories and the made-up sample trip in `src/test/fixture-trip.json`, never the real database; nothing outside tests imports it. `npm run validate` checks the JSON files kept in the repo; every one needs a schema registered in `scripts/validate.ts`.
6. **The editable plan lives in Firestore** under `trips/{tripId}/items`, accessed only through a `PlanRepository` interface; the trip's structure goes through `TripRepository`. Screens never import the Firebase SDK directly. Nothing is deleted in normal use: plan items are marked `removed`, proposals `dismissed`, everything else `archived`. Only Settings > Clean up deletes, through `CleanupRepository`, and `firestore.rules` lets it delete only what's already retired, never a live record or a trip. Research reaches a place only through a proposal someone accepted (`trips/{tripId}/proposals`, through `ProposalRepository`).
7. **Time zone.** "Today" and all trip dates are computed in `Asia/Tokyo` time, never the device's local time zone.
8. **Mobile-first.** Design for a 390px-wide screen first, then widen.
9. **Privacy.** The repo is public. Never commit hotel confirmation numbers, booking references, passport or other personal ID numbers, member emails or service-account keys. Trip IDs live only in links and in Firestore, never in the repo.
10. **Access needs sign-in and membership, and nothing shows before it.** `AppGate` wraps the whole app in the root layout and renders it only for a signed-in member whose trip has arrived, so the static HTML holds only a splash. `firestore.rules` lets a request through only when it is signed in with Google and its email is in the trip document's `members` array. Every rule for a trip uses `isMember(tripId)`; never loosen it to "trip exists". After sign-in the app finds the person's trips with `where("members", "array-contains", email)` (`watchMyTrips`), so no link is needed; a `?trip=` link still opens that trip if they are a member. Only emails in `config/access.tripCreators` can create trips. In the app, Firestore listeners start only once `useAuthStore` says `access === "member"` (a listener refused before sign-in stays dead). Auth goes through `src/lib/auth.ts`; screens never import `firebase/auth`. The Node scripts use the Admin SDK (`scripts/admin-db.ts`) with the developer's Google Cloud login.
11. **Before finishing any task**, run `npm run test`, `npm run validate` and `npm run build`, and fix anything that fails. After changing `firestore.rules`, also run `npm run test:rules` (local emulator, needs Java).

12. **Versions come from git.** `main` carries a `v*` tag; each merge after it adds one to the last number (`next.config.ts`, `src/domain/version.ts`), so nothing is bumped by hand. A new major or minor is a new tag. When a device finds a different version, `src/lib/app-reset.ts` clears its storage and caches and signs it out, keeping only preferences. `version.json` must stay out of the service worker's precache.

13. **All text comes from `src/messages/{en,es}.json`.** Use `t("key")` from `src/lib/i18n.ts`; it works anywhere, and `MessageKey` makes a wrong key fail to compile. ESLint refuses words typed into JSX. `src/domain` stays free of the current language: functions that word something take a `Translate` parameter. Pages stay Server Components, so their text goes in a Client Component. A new language is a new messages file plus `LANGUAGES`, `firestore.rules` and `INTL_LOCALE`. The language is saved in `users/{uid}`. Google Maps stays in English: `liveDetails` and `parseGoogleHours` read Google's English text.

## Commands

| Command                                      | What it does                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                                | Dev server at `http://localhost:3000/itinerary-app/`                       |
| `npm run test`                               | Vitest + React Testing Library                                             |
| `npm run test:rules`                         | The security rules on the local Firestore emulator; never the real database |
| `npm run validate`                           | Zod check of the JSON files kept in the repo                               |
| `TRIP_ID=<id> npm run drafts:pull`           | Export draft places to `research/` for the enrichment run                  |
| `TRIP_ID=<id> npm run places:push -- <file>` | Write researched places back and mark them researched                      |
| `TRIP_ID=<id> npm run places:reset`          | Show what clearing all places would change; `-- --apply` archives them and removes their stops |
| `TRIP_ID=<id> npm run research:pull`         | Export research requests (`docs/research-run.md`)                          |
| `TRIP_ID=<id> npm run research:push -- <file>` | Write research back as proposals to review; never changes a place directly |
| `npm run maps:check`                         | Check the Google keys and test train routes (`docs/maps-setup.md`)         |
| `TRIP_ID=<id> npm run maps:match`            | Save place IDs and coordinates; reports doubtful matches to confirm        |
| `TRIP_ID=<id> npm run maps:refresh`          | Refresh Google coordinates before the 30-day limit                         |
| `npm run build`                              | Static export to `out/`                                                    |
| `npm run preview`                            | Serve `out/` like GitHub Pages, at `http://localhost:4173/itinerary-app/`  |
| `npm run lint` / `npm run format`            | ESLint / Prettier                                                          |

## Layout

- `src/app`: routes (Server Components by default)
- `src/components/ui`: shadcn/ui components
- `src/domain`: schemas, pure trip and plan logic, repository interfaces
- `src/lib`: Firestore repositories, Zustand stores, actions, helpers (`cn`)
- `src/messages`: the app's text, one file per language
- `src/test`: test setup and the sample trip
- `scripts/`: Node scripts run with tsx
- `public/.nojekyll`: copied into `out/` so GitHub Pages serves `_next/`

Deploys: `.github/workflows/deploy.yml` runs tests, validation and the build on every push to `main`, then publishes `out/` to GitHub Pages.
