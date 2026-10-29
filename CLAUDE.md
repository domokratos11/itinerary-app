# Itinerary app: standing rules

A personal trip planner for Japan, Dec 15, 2026 to Jan 12, 2027 (a Wanderlog-like itinerary, no embedded map). Next.js App Router + React + TypeScript, shadcn/ui, static export on GitHub Pages at `https://domokratos11.github.io/itinerary-app/`.

@AGENTS.md

## Rules

1. **Next.js static export only; anything needing a server is not allowed.** `next.config.ts` sets `output: 'export'`, `basePath: '/itinerary-app'` (must equal the repo name), `trailingSlash: true`, `images.unoptimized: true`. No Server Actions, no middleware/proxy, no Route Handlers that read the request, no ISR, no cookies/headers/redirects/rewrites. Every dynamic route must have `generateStaticParams` (and `dynamicParams = false`).
2. **shadcn/ui components first.** Build a custom component only when shadcn has no fit. Components live in `src/components/ui`. Add new ones with `npx shadcn@latest add <name>`.
3. **Client vs Server Components.** Anything using browser APIs, Firestore or Zustand is a Client Component (`'use client'`). Pages stay Server Components that read build-time data and pass it down as props.
4. **No Google Maps API, SDK or key.** Google Maps is used only through plain Maps URLs (`https://www.google.com/maps/search/?api=1&query=...`, `https://www.google.com/maps/dir/?api=1&...`).
5. **Catalog data lives in `data/*.json`** and is validated with Zod: `npm run validate`. Every JSON file in `data/` must have a schema registered in `scripts/validate.ts`; unregistered files fail.
6. **The editable plan lives in Firestore** under `trips/{tripId}/items`, accessed only through a `PlanRepository` interface. Screens never import the Firebase SDK directly.
7. **Time zone.** "Today" and all trip dates are computed in `Asia/Tokyo` time, never the device's local time zone.
8. **Mobile-first.** Design for a 390px-wide screen first, then widen.
9. **Privacy.** The repo is public. Never commit hotel confirmation numbers, booking references, passport or other personal ID numbers. The trip ID lives only in the shared link, never in the repo.
10. **Before finishing any task**, run `npm run test`, `npm run validate` and `npm run build`, and fix anything that fails.

## Commands

| Command                           | What it does                                         |
| --------------------------------- | ---------------------------------------------------- |
| `npm run dev`                     | Dev server at `http://localhost:3000/itinerary-app/` |
| `npm run test`                    | Vitest + React Testing Library                       |
| `npm run validate`                | Zod check of every file in `data/`                   |
| `npm run build`                   | Static export to `out/`                              |
| `npm run lint` / `npm run format` | ESLint / Prettier                                    |

## Layout

- `src/app`: routes (Server Components by default)
- `src/components/ui`: shadcn/ui components
- `src/lib`: helpers (`cn`)
- `data/`: catalog JSON (validated)
- `scripts/`: Node scripts run with tsx (`validate.ts`)
- `legacy/`: V3 planning files, kept as source material for the migration (personal data removed)
- `public/.nojekyll`: copied into `out/` so GitHub Pages serves `_next/`

Deploys: `.github/workflows/deploy.yml` runs tests, validation and the build on every push to `main`, then publishes `out/` to GitHub Pages.
