# Itinerary app: standing rules

A personal trip planner for Japan, Dec 15, 2026 to Jan 12, 2027 (a Wanderlog-like itinerary, no embedded map). Next.js App Router + React + TypeScript, shadcn/ui, static export on GitHub Pages at `https://domokratos11.github.io/itinerary-app/`.

@AGENTS.md

## Rules

1. **Next.js static export only; anything needing a server is not allowed.** `next.config.ts` sets `output: 'export'`, `basePath: '/itinerary-app'` (must equal the repo name), `trailingSlash: true`, `images.unoptimized: true`. No Server Actions, no middleware/proxy, no Route Handlers that read the request, no ISR, no cookies/headers/redirects/rewrites. Every dynamic route must have `generateStaticParams` (and `dynamicParams = false`). Pages whose subject can change at runtime (days, cities) are one static page reading a query parameter instead (`/day/?date=`, `/city/?id=`).
2. **shadcn/ui components first.** Build a custom component only when shadcn has no fit. Components live in `src/components/ui`. Add new ones with `npx shadcn@latest add <name>`.
3. **Client vs Server Components.** Anything using browser APIs, Firestore or Zustand is a Client Component (`'use client'`). Pages stay Server Components that render the static shell; trip data comes from the client stores (`lib/trip-store`, `lib/plan-store`), with `useSearchParams` inside a `Suspense` boundary.
4. **No Google Maps API, SDK or key.** Google Maps is used only through plain Maps URLs (`https://www.google.com/maps/search/?api=1&query=...`, `https://www.google.com/maps/dir/?api=1&...`).
5. **Firestore is the source of truth for the trip; `data/*.json` is the seed and backup.** Cities, stays, reservations and places live under `trips/{tripId}/{cities,stays,reservations,places}`. The `data/` files are bundled as the fallback the app shows until a collection has data, are copied in with `npm run seed`, and are validated with Zod: `npm run validate`. Every JSON file in `data/` must have a schema registered in `scripts/validate.ts`; unregistered files fail.
6. **The editable plan lives in Firestore** under `trips/{tripId}/items`, accessed only through a `PlanRepository` interface; the trip's structure goes through `TripRepository`. Screens never import the Firebase SDK directly. Records are never deleted: plan items are marked `removed`, everything else `archived`.
7. **Time zone.** "Today" and all trip dates are computed in `Asia/Tokyo` time, never the device's local time zone.
8. **Mobile-first.** Design for a 390px-wide screen first, then widen.
9. **Privacy.** The repo is public. Never commit hotel confirmation numbers, booking references, passport or other personal ID numbers. The trip ID lives only in the shared link, never in the repo.
10. **Before finishing any task**, run `npm run test`, `npm run validate` and `npm run build`, and fix anything that fails.

## Commands

| Command                           | What it does                                                   |
| --------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                     | Dev server at `http://localhost:3000/itinerary-app/`           |
| `npm run test`                    | Vitest + React Testing Library                                 |
| `npm run validate`                | Zod check of every file in `data/`                             |
| `TRIP_ID=<id> npm run seed`       | Copy `data/` into the trip in Firestore (`--force` overwrites) |
| `npm run build`                   | Static export to `out/`                                        |
| `npm run lint` / `npm run format` | ESLint / Prettier                                              |

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
