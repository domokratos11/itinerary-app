# Itinerary app: standing rules

A personal trip planner for Japan, Dec 15, 2026 to Jan 12, 2027 (a Wanderlog-like itinerary). Next.js App Router + React + TypeScript, shadcn/ui, static export on GitHub Pages at `https://domokratos11.github.io/itinerary-app/`.

@AGENTS.md

## Rules

1. **Next.js static export only; anything needing a server is not allowed.** `next.config.ts` sets `output: 'export'`, `basePath: '/itinerary-app'` (must equal the repo name), `trailingSlash: true`, `images.unoptimized: true`. No Server Actions, no middleware/proxy, no Route Handlers that read the request, no ISR, no cookies/headers/redirects/rewrites. Every dynamic route must have `generateStaticParams` (and `dynamicParams = false`). Pages whose subject can change at runtime (days, cities) are one static page reading a query parameter instead (`/day/?date=`, `/city/?id=`).
2. **shadcn/ui components first.** Build a custom component only when shadcn has no fit. Components live in `src/components/ui`. Add new ones with `npx shadcn@latest add <name>`.
3. **Client vs Server Components.** Anything using browser APIs, Firestore or Zustand is a Client Component (`'use client'`). Pages stay Server Components that render the static shell; trip data comes from the client stores (`lib/trip-store`, `lib/plan-store`), with `useSearchParams` inside a `Suspense` boundary.
4. **Google Maps follows Google's storage terms.** See `docs/maps-and-research-plan.md`. Screens reach the Maps SDK and APIs only through the `MapsService` interface. Store only place IDs (indefinitely) and Google coordinates (at most 30 days, refreshed by `maps:refresh`, never copied to `data/` or backups). Hours, ratings, photos and route times or distances stay in memory. Google data appears only on a Google map or with the Google logo, never on another map provider. The browser key is public and restricted; the script key stays in the git-ignored `.env`. Google Cloud stays in its own projects, never billing on the Firebase project. Links out still use plain Maps URLs (`https://www.google.com/maps/search/?api=1&query=...`, `https://www.google.com/maps/dir/?api=1&...`).
5. **Firestore is the source of truth for the trip; `data/*.json` is the seed and backup.** Cities, stays, reservations and places live under `trips/{tripId}/{cities,stays,reservations,places}`. The `data/` files are bundled as the fallback the app shows until a collection has data, are copied in with `npm run seed`, and are validated with Zod: `npm run validate`. Every JSON file in `data/` must have a schema registered in `scripts/validate.ts`; unregistered files fail.
6. **The editable plan lives in Firestore** under `trips/{tripId}/items`, accessed only through a `PlanRepository` interface; the trip's structure goes through `TripRepository`. Screens never import the Firebase SDK directly. Records are never deleted: plan items are marked `removed`, everything else `archived`.
7. **Time zone.** "Today" and all trip dates are computed in `Asia/Tokyo` time, never the device's local time zone.
8. **Mobile-first.** Design for a 390px-wide screen first, then widen.
9. **Privacy.** The repo is public. Never commit hotel confirmation numbers, booking references, passport or other personal ID numbers, member emails or service-account keys. The trip ID lives only in the shared link, never in the repo.
10. **Access needs sign-in and membership.** `firestore.rules` lets a request through only when it is signed in with Google and its email is in the trip document's `members` array. Every rule for a trip uses `isMember(tripId)`; never loosen it to "trip exists". In the app, Firestore listeners start only once `useAuthStore` says `access === "member"` (a listener refused before sign-in stays dead). Auth goes through `src/lib/auth.ts`; screens never import `firebase/auth`. The Node scripts use the Admin SDK (`scripts/admin-db.ts`) with the developer's Google Cloud login.
11. **Before finishing any task**, run `npm run test`, `npm run validate` and `npm run build`, and fix anything that fails.

## Commands

| Command                                      | What it does                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                                | Dev server at `http://localhost:3000/itinerary-app/`                       |
| `npm run test`                               | Vitest + React Testing Library                                             |
| `npm run validate`                           | Zod check of every file in `data/`                                         |
| `TRIP_ID=<id> npm run seed`                  | Copy `data/` into the trip in Firestore (`--force` overwrites)             |
| `TRIP_ID=<id> npm run queue:pull`            | Export queued links and draft places to `research/` for the enrichment run |
| `TRIP_ID=<id> npm run places:push -- <file>` | Write researched places back and mark them researched                      |
| `npm run maps:check`                         | Check the Google keys and test train routes (`docs/maps-setup.md`)         |
| `TRIP_ID=<id> npm run maps:match`            | Save place IDs and coordinates; reports doubtful matches to confirm        |
| `TRIP_ID=<id> npm run maps:refresh`          | Refresh Google coordinates before the 30-day limit                         |
| `npm run build`                              | Static export to `out/`                                                    |
| `npm run lint` / `npm run format`            | ESLint / Prettier                                                          |

## Layout

- `src/app`: routes (Server Components by default)
- `src/components/ui`: shadcn/ui components
- `src/domain`: schemas, pure trip and plan logic, repository interfaces
- `src/lib`: Firestore repositories, Zustand stores, actions, helpers (`cn`)
- `data/`: seed JSON (validated)
- `scripts/`: Node scripts run with tsx (`validate.ts`, `seed.ts`)
- `legacy/`: V3 planning files, kept as source material for the migration (personal data removed)
- `public/.nojekyll`: copied into `out/` so GitHub Pages serves `_next/`

Deploys: `.github/workflows/deploy.yml` runs tests, validation and the build on every push to `main`, then publishes `out/` to GitHub Pages.
