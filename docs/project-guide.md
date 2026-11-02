# Itinerary app: project guide

A private, phone-first trip planner for one Japan trip (15 Dec 2026 to 12 Jan 2027). It is a Next.js static site on GitHub Pages, with the trip stored in Firebase Firestore and shown to members who sign in with Google.

This guide explains what the app is made of, where each part lives, how the parts call each other, and what the database holds. Read it top to bottom once, then use the section headings as a map.

**Status:** written from the code on branch `claude/itinerary-app-tech-docs-794e15`. Keep it current with rule 16 in `CLAUDE.md`.

**Privacy:** this file is in a public repo. It names files, collections and fields, never trip IDs, emails, booking numbers or keys.

## Contents

1. [The app in one page](#1-the-app-in-one-page)
2. [Stack and libraries](#2-stack-and-libraries)
3. [Project structure](#3-project-structure)
4. [Build, hosting and deploy](#4-build-hosting-and-deploy)
5. [Routes](#5-routes)
6. [Component tree](#6-component-tree)
7. [Startup sequence](#7-startup-sequence)
8. [Data flow: reads, writes and listeners](#8-data-flow-reads-writes-and-listeners)
9. [Mobile and desktop layouts](#9-mobile-and-desktop-layouts)
10. [Theme](#10-theme)
11. [Search and filters](#11-search-and-filters)
12. [Features by screen](#12-features-by-screen)
13. [Domain logic](#13-domain-logic)
14. [Google Maps and other external APIs](#14-google-maps-and-other-external-apis)
15. [Permissions and security](#15-permissions-and-security)
16. [Sign-in, trips and access](#16-sign-in-trips-and-access)
17. [Offline, PWA and caching](#17-offline-pwa-and-caching)
18. [Versions and updates](#18-versions-and-updates)
19. [Languages (i18n)](#19-languages-i18n)
20. [Research pipeline](#20-research-pipeline)
21. [Scripts (operations)](#21-scripts-operations)
22. [Testing and quality gates](#22-testing-and-quality-gates)
23. [Firestore: structure and analysis](#23-firestore-structure-and-analysis)
24. [Known gaps and stale files](#24-known-gaps-and-stale-files)
25. [Glossary](#25-glossary)

---

## 1. The app in one page

- **Who uses it:** a small group of people listed in a trip's `members` array. Only Google accounts with a verified email can get in.
- **What it does:** shows the trip day by day (cities, hotels, stops, transport, costs), lets members plan each day, keeps a budget, stores reservations and holidays, and keeps a change log with undo.
- **Where the data is:** every trip record lives in Firestore under `trips/{tripId}`. Nothing about a trip is bundled with the code. An empty collection shows as empty.
- **Where it runs:** the browser. There is no app server. Next.js builds static HTML, GitHub Pages serves it, and all data work happens in the browser through the Firebase SDK.
- **Time:** "today" and all trip dates use `Asia/Tokyo`, never the phone's time zone (`src/lib/tokyo-date.ts`).
- **Languages:** English and Spanish (`src/messages/en.json`, `es.json`).
- **Maps:** Google Maps is used for the map, walking routes, place suggestions, photos and opening hours. Links out are plain Google Maps URLs.

Two rules shape almost every file (from `CLAUDE.md`):

1. The site is a **static export**. Nothing may need a server: no Server Actions, no middleware, no request-reading route handlers, no ISR.
2. **Nothing shows before sign-in.** The static HTML contains only a splash screen. The whole app is rendered only for a signed-in member whose trip has loaded.

---

## 2. Stack and libraries

Versions are the ones in `package.json`. "Where" says where the library is used in this repo.

### 2.1 Framework and language

| Technology | Version | What it does here | Where |
|---|---|---|---|
| **Next.js** (App Router) | 16.4.3 | Routes, layouts, pages, static export (`output: "export"`), base path, metadata, fonts, the `manifest.ts` and `version.json` routes. | `next.config.ts`, `src/app/` |
| **React** | 19.3.0 | UI. Used with Server Components for page shells and Client Components (`"use client"`) for everything interactive. | `src/` |
| **react-dom** | 19.3.0 | Browser rendering. | root layout |
| **TypeScript** | ^5 | Language, `strict: true`. | `tsconfig.json`, all `.ts/.tsx` |
| **Tailwind CSS** | ^4 | Utility styling. Theme tokens are CSS variables in `globals.css`. | `src/app/globals.css`, class names in components |
| **@tailwindcss/turbopack** | ^4 | Tailwind loader for Next's Turbopack build. | `next.config.ts` (turbopack rule for `*.css`) |
| **tw-animate-css** | ^1.4.0 | Animation utilities used by shadcn components. | `globals.css` |
| **Oxanium** and **Geist Mono** (via `next/font/google`) | — | App font and monospace font. Downloaded at build time and served from the site, so they work offline. Japanese falls back to system fonts. | `src/app/layout.tsx` |

### 2.2 UI kit and interaction libraries

| Library | Version | What it does here | Where |
|---|---|---|---|
| **shadcn/ui** | CLI ^4.23.0 | Source-owned components copied into the repo. Style `radix-luma`, base colour `stone`, CSS variables on, RSC on. | `src/components/ui/` (28 files), `components.json` |
| **radix-ui** (umbrella package) | ^1.8.1 | Accessible primitives under shadcn components (dialog, select, tabs, tooltip, dropdown, switch, etc.). | `src/components/ui/*` |
| **class-variance-authority** | ^0.7.1 | Variant styles for buttons, badges and similar components. | `src/components/ui/button.tsx` and others |
| **cn** (npm package) | ^0.5.0 | The `cn()` class-merging helper. Note: shadcn usually ships `clsx` + `tailwind-merge`; this repo uses the `cn` package instead. | `src/lib/utils.ts` re-exports it |
| **lucide-react** | ^1.63.0 | Icons. Most components use it (29 files). | many components |
| **@phosphor-icons/react** | ^2.1.10 | Icons. Also used (9 files). `components.json` declares Phosphor as the icon library, so the two icon sets are mixed. | `add-place.tsx`, `day-plan.tsx` and others |
| **cmdk** | ^1.1.1 | The command menu behind the search palette (`Command`, `CommandDialog`). | `src/components/ui/command.tsx`, `search-palette.tsx` |
| **vaul** | ^1.1.2 | Bottom drawers on phones (`Drawer`). | `src/components/ui/drawer.tsx`, `place-details.tsx`, `edit-panel.tsx`, `add-to-day.tsx` |
| **sonner** | ^2.0.8 | Toast messages. Sits above the bottom tab bar on phones. | `src/components/ui/sonner.tsx`, root layout |
| **embla-carousel-react** | ^8.6.0 | Carousel for Google photos. | `src/components/ui/carousel.tsx`, `place-live.tsx` |
| **recharts** | ^3.8.0 | Budget charts (bars, donut, gauge), wrapped by shadcn `chart`. | `src/components/charts.tsx`, `ui/chart.tsx`, `budget-screen.tsx`, `dashboard-screen.tsx` |
| **@dnd-kit/core**, **sortable**, **utilities** | ^6.3.1 / ^10.0.0 / ^3.2.2 | Drag and drop of stops within a day, between days, and from the waiting list. Pointer and keyboard sensors. | `day-plan.tsx`, `day-side-panel.tsx`, `drop.ts` (domain) |
| **fractional-indexing** | ^4.0.0 | Sort keys for plan items, so moving one stop changes only that item. | `src/lib/order.ts` |
| **Zod** | ^4.6.7 | Runtime schemas. Used to validate every Firestore document on read, the bundled sample trip, the message files, the research files and the backup file. | `src/domain/schemas.ts`, `user-repository.ts`, `proposals.ts`, `backup.ts`, `scripts/validate.ts` |

### 2.3 State, i18n and theming

| Library | Version | What it does here | Where |
|---|---|---|---|
| **Zustand** | ^5.0.16 | Client stores: auth, trip structure, plan items, locale, and others. | `src/lib/auth-store.ts`, `trip-store.ts`, `plan-store.ts`, `i18n.ts` |
| **use-intl** (`use-intl/core`) | ^4.14.9 | Message translator behind `t()`. Dates use `Intl` with `en-US` or `es-419`. | `src/lib/i18n.ts` |
| **next-themes** | ^0.4.6 | Light, dark or system theme. Sets a `dark` class on `<html>`. | `src/components/theme-provider.tsx`, `theme-toggle.tsx` |

### 2.4 Backend, data and maps

| Library | Version | What it does here | Where |
|---|---|---|---|
| **firebase** (v13) | ^13.1.0 | Browser SDK: `app`, `app-check` (code present, switched off), `auth` (Google popup), `firestore` (persistent local cache, multi-tab). | `src/lib/firebase.ts`, `auth.ts`, `firestore-*.ts` |
| **firebase-admin** | ^14.5.0 | Admin SDK for the Node scripts, using the developer's own Google Cloud login. Bypasses the rules. | `scripts/admin-db.ts` |
| **Google Maps JavaScript API** | script | Map, walking routes, place suggestions, photos, opening hours, rating. Loaded as one script tag the first time it is needed. | `src/lib/google-maps-service.ts` |
| **Google Places API (New)** | REST | Used by scripts only: text search, place details, IDs and coordinates. | `scripts/maps-api.ts`, `maps-check.ts` |
| **Google Routes API** | REST | Used by `maps:check` to test train routes. The app's walking routes use the Maps SDK's `Route` class instead. | `scripts/maps-check.ts`, `google-maps-service.ts` |
| **Google Fonts** (through `next/font`) | — | Font files, self-hosted at build time. | `layout.tsx` |

### 2.5 PWA, build and tooling

| Tool | Version | What it does here | Where |
|---|---|---|---|
| **workbox-cli** | ^7.4.1 | After `next build`, generates `out/sw.js` that precaches the built files. | `workbox-config.cjs`, `package.json` build script |
| **tsx** | ^4.23.15 | Runs the TypeScript scripts in `scripts/` directly. | `package.json` script entries |
| **ESLint** 9 with **eslint-config-next** 16.4.3 and **typescript-eslint** (via Next's config) | ^9 | Lint. Also custom rules that forbid literal text in JSX and in `aria-label`, `placeholder`, `title`, `alt` and toasts. | `eslint.config.mjs` |
| **Prettier** 3 with **prettier-plugin-tailwindcss** | ^3.9.10 / ^0.8.1 | Formatting and Tailwind class order. | `.prettierrc.json`, `.prettierignore` |
| **Vitest** 5 with **jsdom** | ^5.0.5 / ^30.1.3 | Unit and component tests. | `vitest.config.mts`, `src/**/*.test.*` |
| **@testing-library** (react, dom, jest-dom, user-event) | 16 / 10 / 7 / 14 | Component test helpers. | `src/test/setup.ts`, tests |
| **@firebase/rules-unit-testing** | ^6.0.0 | Tests the Firestore rules against the local emulator. | `tests/rules/firestore.rules.test.ts`, `vitest.rules.config.mts` |
| **firebase-tools** 13 (run with `npx`) | — | Firestore emulator for the rules tests. Needs Java. | `package.json` `test:rules` script |
| **shadcn** CLI | ^4.23.0 | Adds components to `src/components/ui`. | `components.json` |
| **@types/google.maps** | ^3.66.9 | Types for the Maps SDK. | `src/lib/google-maps-service.ts` |
| **GitHub Actions** (`actions/checkout@v4`, `setup-node@v4`, `upload-pages-artifact@v3`, `deploy-pages@v4`) | — | CI and Pages deploy. | `.github/workflows/deploy.yml` |

### 2.6 How the pieces are wired together

```
Browser (static HTML + JS)
 ├─ Next.js App Router (pages are pre-rendered Server Components)
 ├─ React client components ── Zustand stores ── hooks (use-*.ts)
 │     └─ actions (plan-actions, trip-actions, proposal-actions)
 │           └─ repository interfaces (src/domain/*-repository.ts)
 │                 └─ Firestore implementations (src/lib/firestore-*.ts) ── Firebase SDK ── Firestore + Auth
 ├─ MapsService interface (src/domain/maps-service.ts)
 │     └─ GoogleMapsService (src/lib/google-maps-service.ts) ── Maps JS SDK (one script tag)
 └─ service worker (sw.js, precache) and version check (version.json)

Node scripts (scripts/*.ts, run with tsx)
 ├─ firebase-admin (scripts/admin-db.ts) ── Firestore (bypasses rules)
 └─ REST calls (scripts/maps-api.ts) ── Google Places API (New) and Routes API
```

The rule that holds this together: **screens never import the Firebase SDK or the Maps SDK directly.** They call hooks and actions, which call interfaces (`TripRepository`, `PlanRepository`, `ProposalRepository`, `UserRepository`, `ActivityRepository`, `CleanupRepository`, `MapsService`). Tests swap in the in-memory versions (`local-*.ts`).

---

## 3. Project structure

### 3.1 Top level

| Path | What it is |
|---|---|
| `src/` | All application code and tests. |
| `scripts/` | Node scripts for data, research and Maps work. Run with `tsx`. |
| `tests/rules/` | Firestore security rules tests (emulator). |
| `docs/` | Operational docs: Maps setup and plan, research run guide, remaining work plan, and this guide. |
| `public/` | Static files copied as-is: icons, `.nojekyll` (so GitHub Pages serves `_next/`), Google Maps logo. |
| `links/` | `nagoya.txt`: a list of short Google Maps links. No code or script reads it (see §24). |
| `.github/workflows/deploy.yml` | Build and deploy to GitHub Pages on each push to `main`. |
| `firebase.json` | Firestore rules file and emulator ports (Firestore on 8181, UI off, single project mode). |
| `firestore.rules` | The security rules. Pasted into the Firebase console by hand; the deploy does not publish them. |
| `next.config.ts` | Static export, base path `/itinerary-app`, trailing slashes, unoptimized images, app version from git tags. |
| `workbox-config.cjs` | Service worker precache rules. |
| `components.json` | shadcn/ui settings. |
| `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore` | Lint and format configuration. |
| `vitest.config.mts`, `vitest.rules.config.mts` | Test configurations (app tests and rules tests). |
| `tsconfig.json` | TypeScript configuration (`strict`). |
| `package.json`, `package-lock.json` | Dependencies and npm scripts. |
| `AGENTS.md` | Notice that this Next.js version has breaking changes; read the bundled docs in `node_modules/next/dist/docs/` before coding. Written by `next dev`. |
| `CLAUDE.md` | Standing project rules (the 15+ numbered rules, commands, layout). |
| `README.md` | Setup for Firebase, versions, languages. |
| `.claude/launch.json` | Dev server configuration for the preview tools. |
| `Trip Planner — Feasibility & Build Plan.md` | An early plan from October 2026. **Superseded** (it says there is no Google Maps and open editing); kept as history. See §24. |

### 3.2 `src/app`: routes

| File | Route |
|---|---|
| `layout.tsx` | Root layout for every page (fonts, metadata, providers, gates, header, sidebar, tab bar). |
| `page.tsx` | `/`: Dashboard. |
| `days/page.tsx` | `/days/`: the list of days, with trip header, today card, notices and the day list. |
| `day/page.tsx` | `/day/?date=YYYY-MM-DD`: one day. One static page for all dates. |
| `cities/page.tsx` | `/cities/`: all cities in trip order. |
| `city/page.tsx` | `/city/?id=<cityId>&place=<placeId>`: one city's places. |
| `budget/page.tsx` | `/budget/`: spending and budget. |
| `settings/page.tsx` | `/settings/`: trip administration. |
| `not-found.tsx` | 404 page. Also `404.html` on Pages, where old day and city links are redirected (`old-link-redirect.tsx`). |
| `manifest.ts` | `manifest.webmanifest` (installable app). |
| `version.json/route.ts` | `version.json` with the deployed version. `force-static`, so no request is read. |
| `globals.css` | Theme tokens, Tailwind import, dark variant, base styles. |
| `favicon.ico` | Browser icon. |
| `days/page.test.tsx` | A test kept beside its page. |

Every page file is a Server Component that renders a `main` wrapper and one client screen component inside `Suspense`. The page itself reads no data.

### 3.3 `src/components`: UI

Shared chrome and gates:

| File | Role |
|---|---|
| `app-gate.tsx` | Shows the splash, sign-in, trip picker, "not on this trip" and offline screens. Renders the app only when access is `member` and the trip has loaded. |
| `app-header.tsx` | Top bar (trip switcher, section links on tablets, search, activity, account). Exports `BottomNav` (phone tab bar), `VersionTag` (desktop corner text) and `SECTIONS` (the five sections). |
| `app-sidebar.tsx` | Left sidebar on wide screens: sections and every trip day with city colour dots and stop counts. |
| `version-gate.tsx` | Runs first: sets the language, clears storage from an older version, checks for a newer deploy. |
| `plan-sync.tsx` | Mounted once; starts the auth, plan and trip listeners. |
| `locale-root.tsx` | Remounts the app when the language changes. |
| `service-worker-register.tsx` | Registers `sw.js` in production. |
| `offline-banner.tsx` | Shows "offline" text; edits still save on the device. |
| `theme-provider.tsx`, `theme-toggle.tsx` | Theme state and the Match phone / Light / Dark button. |
| `search-palette.tsx` | The Ctrl+K / ⌘K search over days, hotels and places. |
| `trip-switcher.tsx`, `new-trip.tsx` | Trip name menu; panel to create a trip (for permitted creators). |
| `account-sheet.tsx` | Account side sheet: signed-in email, theme, language, About, sign-out. |
| `activity-sheet.tsx` | Change log sheet with undo. |
| `language-select.tsx` | Language picker. |
| `trip-name.tsx`, `trip-dates.tsx`, `trip-plan-status.tsx` | Small trip header pieces. |
| `old-link-redirect.tsx` | Forwards old `/day/2026-…/` and `/city/nagoya/` links to the query-string form. |

Screens (one per page):

| File | Page | Role |
|---|---|---|
| `dashboard-screen.tsx` | `/` | Dashboard tiles and charts: days to go, trip length, stops today, budget, next reservation, stay tonight, warnings, places to research. |
| `today-card.tsx` | `/` and `/days/` | Today in Japan: during the trip shows the day and the next stop with directions; before it, a countdown. |
| `trip-days.tsx`, `needs-new-day.tsx`, `research-notice.tsx` | `/days/` | Day list; stops left without a valid day after stays changed; research results waiting for review. |
| `day-screen.tsx` | `/day/` | Loads one day and renders `DayPlan`. |
| `day-plan.tsx` | `/day/` | The day itself: stops, legs, costs, warnings, map, waiting list, drag and drop. |
| `day-side-panel.tsx` | `/day/` (wide) | The columns of the day view: the day, other days, waiting places. Also drag IDs. |
| `city-screen.tsx` | `/city/` | Loads one city and renders `CityCatalog`. |
| `city-catalog.tsx` | `/city/` | Place catalogue: list or map, filters, add place, cost and details. |
| `cities-screen.tsx` | `/cities/` | Cities, dates, and how much of each is planned. |
| `budget-screen.tsx`, `expense-form.tsx`, `yen.tsx`, `cost-line.tsx`, `leg-line.tsx` | `/budget/` | Expenses, totals by category and payer, charts, gauge. |
| `settings-screen.tsx` | `/settings/` | Tabs: Stays, Cities, Places, Bookings, Holidays, Trip, Backup, Clean up. |
| `settings-stays.tsx`, `settings-cities.tsx`, `settings-places.tsx`, `settings-reservations.tsx`, `settings-holidays.tsx`, `settings-trip.tsx` | Settings tabs | Admin editors for each collection. `settings-places.tsx` also holds the research requests and proposal review. |
| `settings-backup.tsx` | Settings tab | Export the whole trip as JSON; import only into an empty trip. |
| `settings-cleanup.tsx` | Settings tab | Lists retired records and deletes them for good. |
| `settings-about.tsx` | Account sheet | Version and "start fresh" button. |

Plan and place editing:

| File | Role |
|---|---|
| `place-details.tsx` | Place sheet (wide) or drawer (phone): notes, live details, add to day, edit, research. |
| `place-live.tsx` | Google photos, rating and today's hours. Only fetched on demand. |
| `place-editor.tsx` | Form for a place's fields. |
| `edit-panel.tsx` | Dialog (wide) or drawer (phone) that wraps forms. |
| `stop-editor.tsx` | Edit one stop (time, duration, note, leg note). |
| `add-place.tsx` | Add a place by name (Google suggestions) or by pasted Maps link. |
| `add-to-day.tsx` | Choose day and position for a place. |
| `proposal-review.tsx` | Compare old and new values for a research proposal, accept field by field. |
| `trip-map.tsx` | Google map through `MapsService`: pins, routes, theme-aware. |
| `tag-badges.tsx` | Category and priority badges and options. |
| `charts.tsx` | Chart helpers for budget and dashboard. |

Base components:

| Folder | Role |
|---|---|
| `src/components/ui/` | 28 shadcn/ui components. Do not hand-edit; add with `npx shadcn@latest add <name>`. Files include `alert-dialog`, `button`, `card`, `carousel`, `chart`, `command`, `dialog`, `drawer`, `dropdown-menu`, `select`, `sheet`, `sidebar`, `sonner`, `tabs`, `toggle-group`, `tooltip`, and others. |

### 3.4 `src/domain`: pure logic and interfaces

No React, no Firebase, no current language. Functions that need words take a `Translate` parameter. This is the layer to unit-test.

| File | Role |
|---|---|
| `schemas.ts` | The Zod schemas for every Firestore record and the enums (categories, priorities, statuses, expense categories, reservation types, legs). |
| `trip.ts` | `TripData` type, `TRIP_COLLECTIONS`, `EMPTY_TRIP`, `activeTrip` (hides archived records, sorts), `stayId`, endpoint and stay grouping helpers. |
| `trip-repository.ts` | `TripRepository` interface and `TripAccess` / `TripSummary` types. |
| `plan-repository.ts` | `PlanRepository` interface; `markRemoved`. |
| `proposal-repository.ts` | `ProposalRepository` interface. |
| `user-repository.ts` | `UserRepository` interface and the user profile schema (language, last trip). |
| `activity.ts` | Activity schema, kinds, `ActivityRepository`, and `undoFor`. |
| `cleanup.ts` | Plans the Clean up step (what is retired and can go) and the `CleanupRepository` interface. |
| `backup.ts` | Backup file schema and builder. |
| `plan.ts` | Plan logic: items for a day, next stop, keys for insert, stop warnings, costs, stop times, time and holiday warnings, leg notes, hotels for a day. |
| `days.ts` | `deriveDays`: the trip's days, from the stays (a day belongs to every stay whose range includes it). `tripPhase` (before, during, after). |
| `legs.ts` | Legs between stops (walk, transit, taxi) and distance formatting. Walking legs are at most `WALK_LEG_MAX_KM` (1.5 km). |
| `drop.ts` | Drop rules for drag and drop (which target, which order key). |
| `location.ts` | Google coordinate expiry (30 days) and refresh (after 20 days); match radii for the place matcher. |
| `live-hours.ts` | Parses Google's opening hours text (English) into periods; "open now". |
| `map-pins.ts` | Map pins, colours and straight lines for the trip map. |
| `maps-service.ts` | `MapsService` interface and map types. |
| `budget.ts` | Budget summary, totals by category and by payer, per-day spending, estimates from places, yen and USD formatting. |
| `dashboard.ts` | Figures for the dashboard tiles. |
| `proposals.ts` | Research proposals: new, open check, accept field by field, research result schema and cleaning. |
| `place-edit.ts` | Place form: fields, validation, changes, filters (`PLACE_FILTERS`), Maps link parsing, draft places. |
| `trip-edit.ts` | Stay issues and day changes when stays move. |
| `taxonomy.ts` | Colours for categories, priorities and expenses; dark-mode colour steps. |
| `version.ts` | `versionFromDescribe`: turns `git describe` output into a version number. |
| `i18n.ts` | `MessageKey` (every text key, from `en.json`), `MessageValues`, `Translate`. |
| `test-place.ts`, `src/test/fixture-trip.ts` | Helpers and the made-up sample trip for tests. |

### 3.5 `src/lib`: browser services, stores, hooks, repositories

Firebase and repositories:

| File | Role |
|---|---|
| `firebase.ts` | Starts the Firebase app (once), App Check (off unless a key is set), and Firestore with a persistent local cache and multi-tab manager. `getFirebaseAuth()` for Auth. |
| `firebase.config.ts` | Firebase web config and the App Check site key (`null` = off). Public values; access is decided by the rules. |
| `auth.ts` | The only file that talks to `firebase/auth` for sign-in: Google popup, `watchUser`, sign-out, session clear. |
| `firestore-trip-repository.ts` | Implements `TripRepository` on `trips/…`. Skips rows that fail the schema. Batches writes in chunks of 450. |
| `firestore-plan-repository.ts` | Implements `PlanRepository` on `trips/{id}/items`. |
| `firestore-proposal-repository.ts` | Implements `ProposalRepository` on `trips/{id}/proposals`. |
| `firestore-user-repository.ts` | Implements `UserRepository` on `users/{uid}`. |
| `firestore-activity-repository.ts` | Implements `ActivityRepository` on `trips/{id}/activity` (newest first, limited). |
| `firestore-cleanup-repository.ts` | Implements `CleanupRepository`: counts, lists and deletes retired records (the only code that deletes). |
| `*-repository-instance.ts` | The single instance each screen uses (`tripRepository`, `planRepository`, and others). |
| `local-*-repository.ts` | In-memory versions for tests. |

State and sync:

| File | Role |
|---|---|
| `auth-store.ts` | Zustand: sign-in status, user, trips, access, canCreateTrips, trip ID. `useActiveTrip()`. |
| `use-auth-sync.ts` | Watches sign-in, loads the person's trips and profile, picks a trip, checks membership, remembers the trip. |
| `trip-store.ts` | Zustand: trip collections, loaded flags, error. Hooks `useTrip`, `useTripDays`, `usePlacesById`, `useCitiesById`. |
| `use-trip-sync.ts` | Subscribes to the six trip collections when access is `member`. |
| `plan-store.ts` | Zustand: plan items, ready flag, error. |
| `use-plan-sync.ts` | Subscribes to `items` for the trip. |
| `use-proposals.ts`, `use-activity.ts` | Live proposals (always), and the activity log (only while its sheet is open). |
| `use-trip-id.ts` | The open trip's ID from the auth store. |
| `trip-id.ts` | Trip ID format (`[A-Za-z0-9_-]`, 6 to 128 characters), remembering it on the device, choosing a trip, opening trips. |
| `plan-actions.ts` | Every plan change: add, move, re-key, edit, remove, restore. Updates the store first, then saves. |
| `trip-actions.ts` | Every change to trip records (`saveRecord`, `archiveRecord`, `saveBudget`). |
| `proposal-actions.ts` | Request research; accept or dismiss proposals. |
| `activity-log.ts` | Writes activity entries without ever failing the change. |
| `device-name.ts` | The name this device signs its changes with (kept in localStorage). |
| `backup-actions.ts` | Export and import of the trip file. |
| `trip-actions.test.ts` etc. | Tests beside each module. |

Maps and place helpers:

| File | Role |
|---|---|
| `maps.config.ts` | Maps browser key and Map ID. Public values; restricted in Google Cloud. |
| `maps-service-instance.ts` | The one `MapsService` instance. |
| `google-maps-service.ts` | Implements `MapsService` with the Maps JS SDK. Loads the script once. |
| `local-maps-service.ts` | In-memory stand-in for tests. |
| `use-walking-legs.ts` | Walking routes for a day's short legs, kept in memory. |
| `tap-limit.ts` | Per-device daily limit on paid Google calls (photos and live details, 15 each per day). |
| `catalog-filter.ts` | Filters the city catalogue (category, priority, unassigned) and finds nearby places (1 km). |
| `geo.ts` | Straight-line distance. |
| `tokyo-date.ts` | Date helpers in Tokyo time. |
| `format-day.ts` | Day labels, such as "Thursday 17 Dec". |
| `category-label.ts`, `taxonomy-icons.ts` | Labels and icons per category. |
| `links.ts` | Internal links that keep `?trip=`. |
| `base-path.ts` | `BASE_PATH` for URLs the browser fetches directly. |
| `order.ts` | Sort keys with fractional indexing. |
| `use-media-query.ts`, `use-online.ts` | Responsive and connectivity hooks. |

Version and update:

| File | Role |
|---|---|
| `app-reset.ts` | `APP_VERSION`, the storage reset (keeps `locale`, `theme`, `device-name`, `sidebar-open`), cache clearing, reload. |
| `version-check.ts` | Compares the running version with `version.json` and decides whether to reset. |

### 3.6 `src/messages`, `src/test`, `scripts`

- `src/messages/en.json` and `es.json`: every visible string. Both must have the same keys. Validated by `scripts/validate.ts`.
- `src/test/setup.ts`: Testing Library and jest-dom, mocks the activity repository, stubs `ResizeObserver`.
- `src/test/fixture-trip.json`: the made-up sample trip (two cities, sample hotels and places). Validated against `TripDataSchema`. Used only by tests.
- `scripts/`: see §21.

### 3.7 File counts (tracked files)

| Area | Files |
|---|---|
| All tracked files | 270 |
| `src/domain` (non-test modules) | 25 |
| `src/components` (top-level, not `ui`) | 62 |
| `src/lib` | 69 (including tests) |
| `src/components/ui` | 28 |
| Scripts | 16 |
| Docs (`docs/`) | 5 |
| Test files (`*.test.*`) | 40 |

---

## 4. Build, hosting and deploy

### 4.1 Build steps

`npm run build` does two things in order:

1. `next build`: static export to `out/` (`output: "export"`). Each page becomes HTML. `version.json` and `manifest.webmanifest` are generated.
2. `workbox generateSW workbox-config.cjs`: writes `out/sw.js` and precaches the files in `out/` (see §17). `version.json` is excluded so it always reflects the live deploy.

Settings that matter (`next.config.ts`):

| Setting | Value | Why |
|---|---|---|
| `output` | `"export"` | Static HTML only. |
| `basePath` | `/itinerary-app` | GitHub Pages sub-path. Must match the repo name. |
| `trailingSlash` | `true` | Pages look for `folder/index.html`. Links end in `/`. |
| `images.unoptimized` | `true` | No image server exists. |
| `env.NEXT_PUBLIC_BASE_PATH` | the base path | Client code (service worker, manifest) reads it. |
| `env.NEXT_PUBLIC_APP_VERSION` | from git (§18) | Shown in the app and used for resets. |
| `turbopack.rules` | `*.css` with `@tailwindcss/turbopack` | Tailwind v4 build. |

### 4.2 Hosting

- **GitHub Pages** serves `out/` at `https://domokratos11.github.io/itinerary-app/`.
- `public/.nojekyll` is copied into `out/`, so Pages serves `_next/` folders.
- `404.html` (from `not-found.tsx`) handles unknown paths, including old day and city links.
- The site is public; the data is not. Firestore rules are what protect it.

### 4.3 CI/CD

`.github/workflows/deploy.yml`:

- Triggers: push to `main`, or manual run.
- Job `build`: checkout with full history (needed for the version from tags), Node LTS, `npm ci`, `npm run test`, `npm run validate`, `npm run build`, upload `out/` as the Pages artifact.
- Job `deploy`: `actions/deploy-pages@v4`.
- **Not in CI:** `npm run lint` and `npm run test:rules`. Run them by hand. `firestore.rules` is also **not** published by the deploy: paste it into the Firebase console (Firestore → Rules → Publish).

---

## 5. Routes

All routes are static. Dynamic data comes from query strings, read in the browser. No route uses `[param]` segments, so `generateStaticParams` is not needed (CLAUDE.md rule 1).

| URL | File | Query | What it shows |
|---|---|---|---|
| `/itinerary-app/` | `app/page.tsx` | `?trip=` | Dashboard |
| `/itinerary-app/days/` | `app/days/page.tsx` | `?trip=` | Days list |
| `/itinerary-app/day/` | `app/day/page.tsx` | `?date=YYYY-MM-DD&trip=` | One day |
| `/itinerary-app/cities/` | `app/cities/page.tsx` | `?trip=` | Cities |
| `/itinerary-app/city/` | `app/city/page.tsx` | `?id=<cityId>&place=<placeId>&trip=` | One city; `place` opens that place |
| `/itinerary-app/budget/` | `app/budget/page.tsx` | `?trip=` | Budget |
| `/itinerary-app/settings/` | `app/settings/page.tsx` | `?trip=`, optional `?tab=<section>` | Settings (opens the named tab, default Stays) |
| `/itinerary-app/404.html` | `app/not-found.tsx` | any | Not found; redirects old links |
| `/itinerary-app/manifest.webmanifest` | `app/manifest.ts` | — | Install metadata |
| `/itinerary-app/version.json` | `app/version.json/route.ts` | — | `{ "version": "x.y.z" }` |
| `/itinerary-app/sw.js` | generated by Workbox | — | Service worker |

**`?trip=`** is the trip ID. Every internal link keeps it (`pageHref()` in `src/lib/links.ts`), so a shared link keeps working after navigation. The trip ID is in the link only, never in the repo.

**Old links:** before the static-query design, pages were `/day/2026-12-18/` and `/city/nagoya/`. `old-link-redirect.tsx` on the 404 page forwards them to `/day/?date=…` and `/city/?id=…`.

**Navigation** is Next's `Link` (client-side) for internal links, and `window.location` for full reloads when the trip changes (`openTrip`, `openMyTrips`), so nothing from the previous trip stays in memory.

---

## 6. Component tree

### 6.1 Root layout, top to bottom

```
<html lang="en">                            src/app/layout.tsx (Server Component)
 <body>
  ThemeProvider                            next-themes; dark class on <html>
   VersionGate                             version check, storage reset, initLocale
    ServiceWorkerRegister                 registers sw.js (production)
    Suspense > PlanSync                   auth, trip and plan listeners (no DOM)
    LocaleRoot                            remounts the app on language change
     AppGate                              splash / sign-in / trip picker / member app
      AppSidebarProvider                  sidebar open state (localStorage)
       AppHeader (Suspense)               trip switcher, section links (md), search, activity, account
       OfflineBanner                      shown when offline
       <div flex>
         AppSidebar (Suspense)            wide screens only (lg and up)
         <div>{children}</div>            the page: main > screen component
       BottomNav (Suspense)               phone tab bar (below md)
       VersionTag                         desktop corner text (md and up)
   Toaster (sonner)                       above the tab bar on phones
```

### 6.2 Screen components per page

| Page | Screen | Main children |
|---|---|---|
| `/` | `DashboardScreen` | `TodayCard`, tiles, `Charts`, `Yen` |
| `/days/` | `TripName`, `TripDates`, `TripPlanStatus`, `ExportTrip`, `TodayCard`, `NeedsNewDay`, `ResearchNotice`, `TripDays` | — |
| `/day/` | `DayScreen` → `DayPlan` | `DaySidePanel` columns, `StopEditor`, `PlaceDetails`, `EditPanel`, `TripMap`, `CostLine`, `LegLine`, `CategoryBadge`, `PriorityBadge`, `WaitingTags` |
| `/city/` | `CityScreen` → `CityCatalog` | `TripMap`, `PlaceDetails`, `AddPlace`, `CostLine`, `ToggleGroup` filters, `Select` for priority |
| `/cities/` | `CitiesScreen` | — |
| `/budget/` | `BudgetScreen` | `ExpenseForm`, `EditPanel`, `BudgetGauge`, `DonutChart`, `BarList`, `Yen` |
| `/settings/` | `SettingsScreen` | one panel per tab (`Stays`, `Cities`, `Places`, `Reservations`, `Holidays`, `Trip`, `Backup`, `Cleanup`); `EditPanel` in each; `ProposalReview` in Places |

### 6.3 Shared overlays

| Overlay | Used by | Phone | Wide (768px and up) |
|---|---|---|---|
| `PlaceDetails` | day, city | Drawer (vaul) | Sheet (side) |
| `EditPanel` | place editor, stop editor, expenses, settings forms | Drawer | Dialog |
| `AddToDay` | place details | Drawer | Dialog |
| `SearchPalette` | header | Command dialog | Command dialog (`Ctrl K` hint) |
| `ActivitySheet` | header | Sheet | Sheet |
| `AccountSheet` | header | Sheet | Sheet |
| `NewTripPanel` (uses `EditPanel`) | gate, trip switcher | Drawer | Dialog |

---

## 7. Startup sequence

What happens on first load, in order:

1. **Static HTML** is served. It contains the `Splash` (the icon) and nothing else about the trip. Nothing about the trip is in the HTML.
2. **`VersionGate`** (client) runs first:
   - `initLocale()` sets the language: the last choice from localStorage, otherwise the browser language (Spanish if it starts with `es`, else English).
   - In production only: removes `?v=` from the URL; if the stored version is different, resets the device (`resetApp`); otherwise fetches `version.json`, and shows the app once the check answers or after 2 seconds, whichever comes first.
   - Rechecks when the tab becomes visible again.
3. **Providers mount**: `ServiceWorkerRegister`, `PlanSync`, `LocaleRoot`.
4. **`AppGate`** starts with `status: "loading"` and renders `Splash`.
5. **`useAuthSync`** (inside `PlanSync`):
   - `watchUser` (Firebase Auth state) sets `status` to `signed-in` or `signed-out`.
   - If signed in: `canCreateTrips()` reads `config/access`; `watchMyTrips(email)` lists trips where `members` contains the lowercase email; `users.get(uid)` loads the profile (language, last trip).
   - Language: the saved profile language wins; otherwise the current language is saved to the profile.
   - Trip choice (`chooseTrip`): the `?trip=` link first; then the remembered trip or last trip if it is in the list; then the only trip if there is exactly one.
   - Access: `watchAccess(tripId)` reads `trips/{tripId}`: `member` (exists), `denied` (permission denied), or `missing` (not in cache and not on server).
6. **`AppGate` decides what to show**:

| Auth state | What shows |
|---|---|
| `loading` | Splash |
| `signed-out` | "Sign in" screen with language choice and Google sign-in |
| signed in, no trip chosen, trips still loading | Splash (or offline screen if offline) |
| several trips, none chosen | Trip picker |
| no trips | "No trips" screen (with "New trip" if allowed) |
| `access = denied` | "Not on this trip" |
| `access = missing` | "Trip not found" |
| `access = checking` | Splash (or offline screen) |
| `member`, trip collections not yet loaded | Splash |
| `member`, loaded | The app |

7. **Listeners open only for `member`** (`PlanSync`): `usePlanSync(tripId)` subscribes to `items`, `useTripSync(tripId)` subscribes to the six collections. Until then the rules would refuse them.
8. **Remembering**: once a member is confirmed, the trip ID is saved in localStorage and in `users/{uid}.lastTripId`.

---

## 8. Data flow: reads, writes and listeners

### 8.1 Reads

```
Firestore (trips/{id}/cities|stays|reservations|places|holidays|expenses)
   └─ onSnapshot ─ FirestoreTripRepository.subscribe ─ zod parse (bad rows skipped)
        └─ useTripSync ─ tripStore.setCollection(name, rows)
             └─ hooks: useTrip() (archived hidden, sorted), useTripDays(), usePlacesById(), useCitiesById()
                  └─ screens re-render

Firestore (trips/{id}/items)
   └─ onSnapshot ─ FirestorePlanRepository.subscribe ─ zod parse
        └─ usePlanSync ─ planStore.setItems(items)
             └─ screens, sidebar counts, day plan
```

Each listener delivers the full list, not diffs. Each snapshot replaces the store contents.

### 8.2 Writes (optimistic)

```
UI event (drop, edit, add, archive, budget change)
 └─ action (plan-actions.ts / trip-actions.ts / proposal-actions.ts)
     ├─ store.apply(...)              shows the change at once
     ├─ repository.save(...)          setDoc on the document (whole document, so rules see every field)
     └─ logActivity(...)              one activity entry, fire-and-forget
         ↳ next snapshot replaces the local value; if the rules refuse the write, the snapshot undoes it
```

- Offline: Firestore's local cache queues the write and syncs when the connection returns. The promise resolves when the server has the write.
- Batches: `saveMany` uses `writeBatch` in chunks of 450 (Firestore limit is 500 per batch).

### 8.3 Deletes

Nothing is deleted in normal use:

| Thing | "Remove" means |
|---|---|
| Plan item | `status: "removed"` (restorable; shown in "Recently changed") |
| Trip record (city, stay, place, reservation, holiday, expense) | `archived: true` |
| Proposal | `status: "dismissed"` |
| Activity entry | kept; deleted only by Clean up or by the rules' delete rule for members |

Only **Settings → Clean up** deletes, through `CleanupRepository`. The rules allow deletes only for records already retired (§23).

### 8.4 Activity log

- Every change worth remembering writes one entry (`trips/{id}/activity`): time, device name, kind, target, short summary, and before/after JSON (up to 4,000 characters each).
- Kinds: `added`, `moved`, `reordered`, `edited`, `removed`, `restored`, `undone`, `queued`, `assigned`, `dismissed`, `settings`.
- The sheet subscribes to the newest 50 only while open, so it costs no reads otherwise.
- Undo: `undoFor` in `domain/activity.ts` gives the reverse change while the stop has not changed since.

---

## 9. Mobile and desktop layouts

The app is designed for a 390px phone first, then widened (CLAUDE.md rule 8). Breakpoints are Tailwind's defaults plus two media queries in code.

### 9.1 Breakpoints

| Width | Name in this app | What changes |
|---|---|---|
| below 768px | **phone** | Bottom tab bar (`BottomNav`, five sections). Drawers (vaul) for place details, edit and add-to-day. Day page shows one column at a time: list, map or waiting. Tapping a waiting place adds it (phones can't drag). Version tag hidden (it is under Account → About). |
| 768px and up (`md`) | **tablet / small desktop** | Bottom tab bar hidden. Section links in the header. Dialogs and side sheets instead of drawers. Day page shows the three-column layout. Version tag in the corner. |
| 1024px and up (`lg`) | **desktop** | Header section links hidden (sidebar takes over). Left sidebar with all sections and every trip day. Sidebar can collapse to icons (state kept in localStorage). |
| 1280px and up | **wide** | City catalogue shows list and map side by side (`city-catalog.tsx`). |

### 9.2 How the code decides

- `useMediaQuery("(min-width: 768px)")` (`src/lib/use-media-query.ts`) is used in `day-plan.tsx`, `add-to-day.tsx`, `edit-panel.tsx`, `place-details.tsx`. On the server and the first client render it returns `false` (phone layout), then updates after mount. This keeps the static HTML matching the first render.
- `useMediaQuery("(min-width: 1280px)")` in `city-catalog.tsx` for the side-by-side layout.
- The shadcn sidebar (`ui/sidebar.tsx`) uses `(max-width: 1023px)` to switch to an off-canvas sheet. The app has no trigger for that sheet, so below 1024px the sidebar is never shown; the day list is reached through the Days page.
- Layout classes are Tailwind responsive prefixes (`md:`, `lg:`), used in about 30 component and page files. Page wrappers grow from `max-w-md` (phone) to `max-w-[100rem]` (desktop).
- Bottom padding: the body adds `pb-[calc(4rem+env(safe-area-inset-bottom))]` below `md`, so the tab bar does not cover content.
- `viewportFit: "cover"` and safe-area insets are used so notched phones are handled.

### 9.3 Interaction differences

| Action | Phone | Desktop |
|---|---|---|
| Move a stop | Edit it (time, order) | Drag with pointer; keyboard drags too (dnd-kit sensors) |
| Add a waiting place | Tap it | Drag it to a day or stop, or tap |
| Search | Header search button | Header button or Ctrl K / ⌘K |
| Sections | Bottom tab bar | Sidebar (or header links between 768 and 1023px) |
| Details | Drawer from bottom | Side sheet |
| Toasts | Above the tab bar | Bottom right |

---

## 10. Theme

- **Library:** `next-themes`, in `src/components/theme-provider.tsx`. Attribute `class`, default `system`, `enableSystem`, `disableTransitionOnChange`. It sets `class="dark"` on `<html>` before the first paint, so `suppressHydrationWarning` is on `<html>`.
- **Choices:** Match phone (system), Light, Dark. The button in the Account sheet cycles them (`theme-toggle.tsx`). The choice is stored by next-themes under `theme` in localStorage. It is in the kept-keys list, so it survives a version reset.
- **Tokens:** colours are CSS variables on `:root` and `.dark` in `src/app/globals.css`, in OKLCH: `--background`, `--foreground`, `--primary` (teal, close to the theme colour), `--muted`, `--border`, `--sidebar-*`, `--chart-1..5`, and others. Tailwind maps them to utility names (`bg-background`, `text-muted-foreground`).
- **Dark variant:** `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css`, so `dark:` classes follow the `dark` class.
- **Base colour:** `stone` in `components.json`.
- **Category, priority and expense colours** (`src/domain/taxonomy.ts`): fixed hex colours per category (`lights`, `food`, `shopping`, `sight`, `daytrip`, `temple`), per priority (`must`, `want`, `maybe`) and per expense category. `darkStep` and `tint` produce the dark-mode variants.
- **Map:** `trip-map.tsx` reads `resolvedTheme` and passes `colorScheme: "light" | "dark"` to the Maps service, so the map follows the app.
- **Toasts:** `sonner` reads the theme through `useTheme`.
- **Browser chrome:** `themeColor: "#0f766e"` in the root layout and manifest; background `#ffffff` in the manifest.
- **Cities** have their own colour (`#rrggbb` in `cities` documents), used for dots in the sidebar and day list.
- **Font:** Oxanium (`--font-sans`) and Geist Mono (`--font-mono`) via `next/font`.

---

## 11. Search and filters

### 11.1 Global search (Ctrl K / ⌘K, or the search button on phones)

`src/components/search-palette.tsx`, built on `cmdk` (`Command`, `CommandDialog`). It searches the trip in memory (no server search). Three groups:

| Group | Matches on | Opens |
|---|---|---|
| Days | date, day label, city names | `/day/?date=…` |
| Hotels (stays) | hotel name, city, "hotel" | `/day/?date=<check-in>` |
| Places | name, city name, category | `/city/?id=…&place=…` (the place is opened) |

Matching is done by `cmdk`'s fuzzy filter on the `value` string of each item.

### 11.2 Place catalogue filters (City page)

`src/components/city-catalog.tsx` with `src/lib/catalog-filter.ts`:

| Filter | Options | Note |
|---|---|---|
| View | List, Map | Map shows `TripMap` with the city's pins |
| Category | All, plus each category | Toggle group |
| Priority | All, must, want, maybe | Select |
| Unassigned only | yes/no | "Unassigned" = not used by any active plan item |

Nearby places: `nearbyByPlace` finds other places within 1 km using saved coordinates (`NEARBY_KM`).

### 11.3 Settings → Places filters

`PLACE_FILTERS` in `src/domain/place-edit.ts`:

| Value | Shows places that… |
|---|---|
| `all` | (no filter) |
| `missing-cost` | have no cost estimate |
| `missing-hours` | have no opening hours |
| `no-pin` | have no coordinates |
| `needs-research` | are still drafts |
| `review` | have a research proposal waiting |

### 11.4 Other search-like features

- **Place suggestions** when adding a place: Google's autocomplete (`AutocompleteSuggestion`, with a session token), only when the Maps script is set up and online. Otherwise the name is saved as a draft.
- **Paste a Maps link**: `parseMapsLink` reads a Google Maps URL to find the place.
- **Activity log** filters: none; grouped by day in Japan time, newest first.
- **Dashboard** "places to research": `placesToResearch` in `domain/dashboard.ts`.

---

## 12. Features by screen

### 12.1 Dashboard (`/`)

Tiles built from `domain/dashboard.ts`: days until the trip or days left (`tripClock`), trip length, stops today and left today, stops per day, quiet days, places by category and priority, must-see places not yet planned, stops on closed days, upcoming holidays, nights without a hotel, next reservation, stay tonight, route legs for today, budget summary (`Yen`), and places to research. Charts from `charts.tsx` (recharts via shadcn chart).

### 12.2 Days (`/days/`)

Trip name and dates, plan status, export of the trip (`ExportTrip`), today card, "needs a new day" (stops whose day is no longer valid after a stay moved), research notice (proposals to review), and the list of days (`trip-days.tsx`) with city dots, date, and stop count.

### 12.3 Day (`/day/?date=`)

`day-plan.tsx` (large file) shows, for one date:

- **Stops** in order: time, duration, place, category and priority badges, cost, and a note. Stop times come from `stopTimes` (start times and durations).
- **Legs** between stops (`dayLegs`): the hotel to the first stop, stop to stop, and the last stop back to the hotel. Each leg is keyed by the stop it arrives at (or `end`). Walking routes are used for legs up to 1.5 km (`WALK_LEG_MAX_KM`), fetched from the Maps SDK and kept in memory; straight-line distance is the fallback (`use-walking-legs.ts`).
- **Warnings:** `stopWarnings` flags a place on one of its closed dates; `holidayWarnings` flags a holiday or closure on that date for the place's category; `timeWarnings` compares the stop's start and end times with the place's opening hours; `dayRunsLate` flags a day that runs past `LATE_DAY` (22:00).
- **Hotels** for the day (`hotelsForDay`): check-in and check-out.
- **Waiting list**: places in the trip not yet on a day (`waitingPlaces`).
- **Map** (`TripMap`): pins for the day's stops, lines between them.
- **Drag and drop**: stops within a day, between days, from the waiting list (`drop.ts`). Keyboard support.
- **Bookings button**: lists reservations on the day (wide layout).
- **Costs**: `costTotal` for the day.

### 12.4 Cities (`/cities/`) and City (`/city/?id=`)

- Cities list: each city in trip order with dates and how much is planned.
- City page: the catalogue (§11.2) for one city, with place details, add place, cost lines, and the map.

### 12.5 Budget (`/budget/`)

`budget-screen.tsx` and `domain/budget.ts`:

- **Expenses** (`expenses` collection): title, amount in whole yen, category, date, status (`planned` or `paid`), who paid, and optional links to a place, reservation or stay.
- **Estimates**: each place with a cost estimate counts for its category, unless an expense already covers that place, booking or stay (`estimateStops`).
- **Totals** by category (`totalsByCategory`) and by payer (`totalsByPayer`), and per-day spending (`spendByDay`).
- **Budget** on the trip document: total (yen), by category, and number of travellers (the per-adult estimate is multiplied by travellers; `null` = number of members).
- **Figures**: spent, planned, budget left, days remaining (`daysRemaining`). USD shown with a fixed rate in `budget.ts` (`YEN_PER_USD`).
- **Charts**: donut by category, bars by day, gauge of budget used.

### 12.6 Settings (`/settings/`)

Tabs (`settings-screen.tsx`):

| Tab | Edits |
|---|---|
| Stays | hotels (name, maps link, check-in/out, city, note) |
| Cities | cities (name, colour) |
| Places | places: edit fields, filters, research requests, proposal review (`ProposalReview`), add draft |
| Bookings | reservations (flight, train, hotel, tour, ticket) |
| Holidays | holidays and closures |
| Trip | trip name, members (email list, max 20), budget |
| Backup | export the whole trip as JSON; import only into a trip that has nothing saved |
| Clean up | the retired records (archived, removed, dismissed, legacy queue, activity) and delete them for good; counts shown first |

Account sheet (header): signed-in email, theme toggle, language choice (saved to the profile), About (version, "start fresh" which runs `resetApp`), and sign-out.

### 12.7 Trip switcher and trip creation

- Header trip name opens a menu when there are other trips, or when the person may create one. `New trip` makes a trip with the person as the only member (`createTrip`).
- Only emails in `config/access.tripCreators` can create trips (rules and `canCreateTrips`).

---

## 13. Domain logic

Pure functions in `src/domain/`. Names are the exports most often used.

| Module | Key functions | Rule it encodes |
|---|---|---|
| `days.ts` | `deriveDays(stays)`, `weekdayOf`, `tripPhase` | A day belongs to every stay whose range includes it, both ends included, so transfer days belong to two cities. |
| `trip.ts` | `activeTrip`, `stayId` | Archived hidden; stays sorted by check-in; stay ID = `cityId-checkIn`. |
| `plan.ts` | `itemsForDay`, `nextStop`, `keysForInsert`, `stopTimes`, `timeWarnings`, `holidayWarnings`, `stopWarnings`, `costTotal`, `dayRunsLate`, `newPlanItem`, `distanceBetweenPlaces`, `placeLocation`, `stayLocation`, `directionsUrl` | Order is a fractional key; times are computed from start and duration; "late" means past 22:00. |
| `legs.ts` | `dayLegs`, `formatWalk`, `formatLegNote`, `formatStation` | Walk if ≤ 1.5 km, else transit or taxi. |
| `order.ts` (lib) | `keyAt`, `keysBetween` via fractional-indexing | Moving a stop rewrites one key. |
| `drop.ts` | `planDrop` | Which target a drop lands on (stop, day, list), and which keys change. |
| `location.ts` | `coordinatesExpired`, `dueForRefresh`, `withoutGoogleCoordinates`, `doubtfulMatch`, `medianPoint` | Google coordinates expire after 30 days and are due for refresh from day 20. `doubtfulMatch` flags a match more than 2 km from coordinates already saved, or far from the city centre (30 km; 200 km for day trips). Flagged matches are reported for a person to confirm. |
| `live-hours.ts` | `parseGoogleHours`, `openNowFrom`, `hoursDifference` | Reads Google's English opening-hours text into periods, and works out whether a place is open now. |
| `map-pins.ts` | `placePoint`, `cityPins`, `dayMap`, `straightLines`, `stopColor` | Pins per stop, straight lines when no route. |
| `budget.ts` | `summarizeBudget`, `totalsByCategory`, `totalsByPayer`, `estimateStops`, `spendByDay`, `daysRemaining` | Expenses beat estimates for the same place; yen integers. |
| `dashboard.ts` | many tile functions (see §12.1) | All figures from in-memory data. |
| `proposals.ts` | `newProposal`, `isOpenProposal`, `acceptProposal`, `changedFields`, `researchToAccept`, `cleanResearch`, `ResearchResultSchema` | Research never writes a place. Accepting copies chosen fields and their sources; status becomes `researched`. |
| `place-edit.ts` | `applyPlaceEdit`, `validatePlaceForm`, `missingFields`, `needsResearch`, `parseMapsLink`, `matchesPlaceFilter`, `newDraftPlace` | Locked fields (hand-edited) are never changed by research. |
| `trip-edit.ts` | `stayIssues`, `dayChanges` | When a stay moves, which stops lose their day. |
| `cleanup.ts` | `planCleanup`, `planEverything`, `CLEANUP_KINDS` | What Clean up will delete, from the retired records only. |
| `backup.ts` | `makeBackup`, `BackupSchema`, `backupSummary` | Whole-trip file, validated on import. |
| `activity.ts` | `undoFor`, `ActivitySchema` | Reverse of a change, if the target has not changed since. |
| `budget.ts` | `formatYen`, `formatUsd` | Display formats. |
| `i18n.ts` | `MessageKey`, `Translate` | Compile-time check that a message key exists. |
| `version.ts` | `versionFromDescribe` | `v1.0.0-3-gabc` → `1.0.3`. |

---

## 14. Google Maps and other external APIs

### 14.1 The rule

From `CLAUDE.md` rule 4 and `docs/maps-and-research-plan.md`:

- Screens reach Google only through `MapsService` (`src/domain/maps-service.ts`). The implementation is `GoogleMapsService`. The SDK is one script tag, added on first use.
- **Stored:** Google place IDs (indefinitely) and Google coordinates (at most 30 days; `maps:refresh` renews them). Our own notes, leg times and fares can be stored.
- **In memory only:** hours, ratings, photos, route times and distances.
- Google data appears only on a Google map or next to the Google logo. Never on another map provider.
- The browser key is public and restricted by website and API. The script key stays in a git-ignored `.env`.
- Google Cloud stays in its own projects, not the Firebase project's billing.

### 14.2 Calls the browser makes

| Call | Used for | Cost guard |
|---|---|---|
| Maps JS script (`maps.googleapis.com/maps/api/js`) | Map, markers, libraries (`maps`, `marker`, `core`, `routes`, `places`) | Loaded only when a map is first shown |
| `Route.computeRoutes` (walking) | Walking legs of a day | Cached in memory; stops after the daily cap |
| `AutocompleteSuggestion.fetchAutocompleteSuggestions` | Place suggestions when adding a place | Session token per search |
| `Place.fetchFields` (`location`) | Coordinates for a chosen suggestion (ends the billing session) | — |
| `Place.fetchFields` (`photos`, `regularOpeningHours`, and the live-detail fields listed in `google-maps-service.ts`) | Photos and live details on the place sheet | `TAP_LIMITS` 15 per device per day each for `live` and `photo` (`tap-limit.ts`) |

### 14.3 Calls the scripts make (not the browser)

| Script | Call | Purpose |
|---|---|---|
| `scripts/maps-api.ts` | Places API (New) REST: `places:searchText`, `places/{id}` | Match places to Google, get IDs and coordinates. Only IDs and coordinates are kept. |
| `scripts/maps-check.ts` | Places API (New) and Routes API `computeRoutes` REST; optional Maps Embed test page | Check keys and test train routes in Japan. |
| `scripts/maps-match.ts`, `maps-refresh.ts` | via `maps-api.ts` | Save IDs and coordinates; refresh before the 30-day limit. |

### 14.4 Other external services

| Service | Use | Where |
|---|---|---|
| **Firebase Authentication** | Google sign-in popup (`prompt: select_account`) | `auth.ts` |
| **Cloud Firestore** | All trip, plan, user and proposal data | `firestore-*.ts` |
| **Firebase App Check** | Off (`appCheckSiteKey = null`); code ready for reCAPTCHA v3 | `firebase.ts`, README "Security setup" |
| **Google Fonts** | Oxanium and Geist Mono, self-hosted at build | `layout.tsx` |
| **GitHub Pages** | Hosting | `deploy.yml` |
| **Google Maps short links** | Input only (paste or list); links out use `https://www.google.com/maps/search/?api=1&query=…` and `…/dir/?api=1&…` | `place-edit.ts`, `links`, `maps` UI |

### 14.5 Maps configuration

- `src/lib/maps.config.ts`: browser key and Map ID. "While either is null the app works without the map and live details."
- Map ID: passed to the map as `mapId`, which selects the Google map style.
- Setup steps: `docs/maps-setup.md`. Checklist: `docs/maps-checklist.md`.

---

## 15. Permissions and security

Security is decided in Firestore rules (`firestore.rules`), not in the app. The app's checks are for the user experience only.

### 15.1 Layers

| Layer | Mechanism | Where |
|---|---|---|
| 1. Identity | Firebase Auth with Google; rules require `request.auth` and `email_verified == true` | `auth.ts`, `firestore.rules` `isSignedIn()` |
| 2. Membership | The trip's `members` array (lowercase emails) must contain the caller's email | `isMember(tripId)` |
| 3. Trip creation | Only emails in `config/access.tripCreators` can create trips; the creator must be in the new trip's members | `isTripCreator()`, `isNewTrip()` |
| 4. Data shape | Every write must match a whitelist of fields and types, with size limits and enums | `isPlanItem`, `isCity`, `isStay`, `isReservation`, `isHoliday`, `isPlace`, `isExpense`, `isProposal`, `isActivity`, `isBudget`, `isUserProfile`, `isNewTrip`, `isTripEdit` |
| 5. Document ID match | Every write checks that the document ID equals the record's `id` field | each `match` block |
| 6. Deletes | Only retired records can be deleted (archived, removed, dismissed, applied); trips are never deleted; activity can be deleted by members | each `allow delete` |
| 7. App gate | Nothing renders or listens before a member is confirmed | `AppGate`, `use-trip-sync`, `use-plan-sync`, `useAuthStore.access` |
| 8. Local data | Sign-out wipes the offline cache for this device; a version change clears storage but keeps preferences | `auth.ts` `endSession`, `app-reset.ts` |

### 15.2 Rules, in plain words

- **Default:** every path not listed is denied (`match /{document=**} { allow read, write: if false; }`).
- **`config/access`:** readable only by people on the `tripCreators` list; no list, no writes.
- **`users/{uid}`:** only that person reads or writes their own profile; language must be `en` or `es`; no listing, no delete.
- **`trips/{tripId}`:**
  - `get`: members only. Missing trip = denied, so nobody can test which IDs exist.
  - `list`: only queries where `members` contains the caller's own email.
  - `create`: trip creators only, with one member (themselves) and a name of up to 100 characters.
  - `update`: members only, and only the fields `name`, `members` (1 to 20, must include the caller), `budget`, `updatedAt`.
  - `delete`: never.
- **Trip subcollections** (`cities`, `stays`, `reservations`, `holidays`, `expenses`, `places`, `proposals`, `items`, `activity`): read and write for members, with the schema check on each write. Delete only if already retired.
- **`queue`** (legacy): members can read and delete, nothing else.
- **`activity`:** written once, never updated. Members can delete (for Clean up).

### 15.3 Other security measures

- **No secrets in the repo.** Firebase web config and the Maps browser key are public identifiers; the rules and Maps restrictions protect them. The Maps script key is in `.env` (git-ignored). Admin access uses `gcloud auth application-default login` or a service-account key kept outside the repo (`*.pem` is ignored).
- **Privacy rules** (`CLAUDE.md` rule 9): no hotel confirmations, booking references, ID numbers or member emails in the repo. Trip IDs live in links and in Firestore only.
- **Trip ID format** is checked (`TRIP_ID_PATTERN`) before use.
- **Sign-in popup** rather than redirect (the redirect flow needs the auth domain to be the site's own).
- **Sign-out** signs out of Firebase, terminates the Firestore client, and clears the offline cache for the trip (`clearIndexedDbPersistence`), then reloads.
- **Cost guard:** per-device daily limit on paid Google calls (`tap-limit.ts`), kept in storage and enforced even when storage is blocked.
- **Tokens and keys** in Maps: `maps:check` verifies the keys.
- **Content Security Policy:** none is set in the repo (static hosting on Pages gives no header control).
- **App Check:** code is present but off (`appCheckSiteKey = null`). Turning it on requires a reCAPTCHA v3 key and Firebase console setup.
- **Rules tests:** `tests/rules/firestore.rules.test.ts` (25 test cases) run against the emulator: `npm run test:rules`. Java must be installed. The test project is `demo-itinerary`, so the real database is never touched.

### 15.4 What the rules do not cover

- Anyone who is a member can read and change every record of the trip. Membership is all-or-nothing; there are no per-field or per-role permissions.
- The Admin SDK scripts bypass the rules by design.
- Email is the identity key. Members are added by editing the trip document in the console or through Settings → Trip.

---

## 16. Sign-in, trips and access

| Concept | How it works |
|---|---|
| **Sign-in** | Google popup. Errors mapped to messages: popup blocked, unauthorized domain, operation not allowed, network (`SIGN_IN_ERRORS`). |
| **Session** | Firebase keeps it in IndexedDB, so it survives reloads and works offline. |
| **Trip list** | `watchMyTrips(email)`: `where("members", "array-contains", email)`. Needs no index (single-field). |
| **Opening a trip** | From the link (`?trip=`), the remembered trip, the last trip, or the only trip. Opening another trip reloads the page. |
| **Membership check** | `watchAccess(tripId)` reads `trips/{id}`. Permission denied = not a member; missing = no such trip. |
| **Remembering** | localStorage key `trip-id`, plus `users/{uid}.lastTripId`. |
| **Members** | Trip settings add and remove emails (lowercase, at most 20). The list must always include the person saving it. |
| **New trip** | `config/access.tripCreators` must contain the email. Name required. |
| **Language** | Saved in `users/{uid}.language` and applied at sign-in. |
| **Sign-out** | Clears this device's trip cache. Unsynced edits are lost, which the UI warns about. |

---

## 17. Offline, PWA and caching

### 17.1 Offline data

- **Firestore persistent cache** (`persistentLocalCache` with `persistentMultipleTabManager`): the trip is readable offline once it has been loaded. Writes made offline are queued and sent when the connection returns.
- **Listeners** keep working offline from the cache. A missing trip document from the cache does not count as "missing"; the app waits for the server (`metadata.fromCache`).
- **Offline screens:** while signed in but with no answer and no connection, `AppGate` shows "offline" rather than a spinner.
- **Banner:** `OfflineBanner` shows when `navigator.onLine` is false.
- **Walking routes and place details:** not stored offline (Google's terms); the day shows straight-line distances.

### 17.2 Service worker (PWA)

- `workbox-config.cjs` → `out/sw.js` with `generateSW`.
- Precaches `**/*.{html,js,css,json,png,svg,ico,webmanifest,txt,woff2}` in `out/`. Excludes `version.json`.
- `ignoreURLParametersMatching: [/.*/]`: query strings (`?trip=`, `?date=`) are ignored, so each page matches its one precached file.
- `skipWaiting` and `clientsClaim`: a new worker takes over at once. `cleanupOutdatedCaches` removes old files.
- Registered only in production (`service-worker-register.tsx`), at `${BASE_PATH}/sw.js`.
- The `.txt` files (Next's route data) are cached so a page and its data come from the same build.

### 17.3 Install

- `manifest.ts`: name "Trip Planner", standalone display, teal theme colour, icons 192 and 512 px (`public/icon-*.png`), `start_url` and `scope` under the base path. Apple web-app meta in layout.
- Icons are generated by `scripts/make-icons.cjs` as plain PNGs; replace the files with real artwork later, keeping the names.

---

## 18. Versions and updates

### 18.1 How the number is made

- The version comes from **git tags**, not `package.json` (which stays at `1.0.0`).
- `next.config.ts` runs `git describe --tags --first-parent --match "v*"` and passes the result to `versionFromDescribe`: `v1.0.0-3-gabc1234` → `1.0.3`. With no tag, it falls back to `package.json`.
- Each merge to `main` after the tag adds one to the last number. A new minor or major version is a new tag.
- The value is `NEXT_PUBLIC_APP_VERSION`, read as `APP_VERSION` in `app-reset.ts`.

### 18.2 How devices pick it up

1. `version.json` is generated at build time with the version.
2. The app fetches `version.json` (never cached by the service worker) on start and whenever the tab becomes visible.
3. If the deployed version differs from `APP_VERSION`, `resetApp(deployed)` runs once per tab (`triedVersion` in sessionStorage, so a stale page cannot cause a loop):
   - signs out, with up to 5 seconds to upload pending edits (`clearSession`);
   - clears localStorage except `locale`, `theme`, `device-name` and `sidebar-open`;
   - clears sessionStorage and all Cache Storage entries, and unregisters service workers;
   - reloads `…/?v=<version>` (the `v` is removed after load).
4. Storage stamped with another version is reset on start (`storageIsStale`).
5. Development (`NODE_ENV !== "production"`) skips all of this.

### 18.3 Manual reset

Account sheet → About → "start fresh" runs the same reset.

---

## 19. Languages (i18n)

- **Files:** `src/messages/en.json` and `src/messages/es.json`. Same keys in both. Keys are nested (`nav.days`, `gate.signIn`).
- **Use:** `t("key", values)` from `src/lib/i18n.ts`. Works anywhere. The key type is `MessageKey`, generated from `en.json`, so a wrong key fails to compile.
- **Lint:** `eslint.config.mjs` rejects text typed into JSX, `aria-label`, `placeholder`, `title`, `alt` and toast calls. Allowed literals: arrows, dots, currency sign, "Google Maps", "Ctrl K".
- **Domain code** takes a `Translate` parameter when it produces words, so it stays language-free.
- **Dates:** `Intl` with `en-US` or `es-419` (Latin American Spanish), via `intlLocale()`.
- **Switching:** `setLocale` saves to localStorage and `<html lang>`, updates the store, and `LocaleRoot` remounts the app so every `t()` runs again.
- **Saved per person:** `users/{uid}.language`. Used on every device after sign-in.
- **Google Maps stays in English** (its text is English; `live-hours.ts` parses English).
- **Adding a language** (CLAUDE.md rule 13): new messages file, `LANGUAGES` in `user-repository.ts`, `INTL_LOCALE` in `i18n.ts`, and the rules' allowed language list in `firestore.rules` (`isUserProfile`).
- **Validation:** `scripts/validate.ts` checks both message files against `MessagesSchema`.

---

## 20. Research pipeline

Place facts (opening hours, costs, tips, website, notes) are researched outside the app and reviewed inside it. Research never changes a place directly.

```
Draft place (catalog or added by name)            status: draft
   │  app: "Request research" (Settings → Places)
   ▼
Proposal request (trips/{id}/proposals)           status: requested
   │  npm run research:pull → file for a research run (docs/research-run.md)
   ▼
Research run (outside the repo)                   returns a JSON file
   │  npm run research:push -- <file>
   ▼
Proposal                                          status: ready  (fields + sources)
   │  app: Settings → Places → Review (ProposalReview)
   │  accept field by field, or dismiss
   ▼
Place updated (accepted fields only; sources kept) status: researched
Proposal                                          status: applied (or dismissed)
```

Details:

- `ProposalFieldsSchema` lists the fields research may propose: purpose, description, tips, cost, duration, opening hours, closed dates, season, website (https only), notes, nearest station, verified date. Each field has its own source URL (`FieldSourceSchema`).
- `lockedFields` on a place: fields a person edited by hand. Research never changes them.
- Accepting copies only the chosen fields, replaces their sources, and sets the place to `researched` if anything changed.
- Proposals with `status` `applied` or `dismissed` can be deleted in Clean up.
- `places:push` (`scripts/places-push.ts`) writes researched places directly, for bulk loads. It marks them `researched`.
- `places:reset` (`scripts/places-reset.ts`) archives all places and removes their stops, only with `--apply` (dry run by default).
- The research file format is documented in `docs/research-run.md`.

---

## 21. Scripts (operations)

All scripts need `TRIP_ID` where noted, and the Google Cloud login (`gcloud auth application-default login`) for Firestore. Keys for Maps come from `.env`.

| npm script | File | What it does | Writes to Firestore? |
|---|---|---|---|
| `dev` | — | Dev server at `http://localhost:3000/itinerary-app/` | — |
| `build` | — | Static export and service worker | — |
| `preview` | `scripts/preview.cjs` | Serves `out/` at `http://localhost:4173/itinerary-app/` like Pages | — |
| `test` | — | Vitest, one run | — |
| `test:watch` | — | Vitest in watch mode | — |
| `test:rules` | — | Firestore rules tests on the emulator | No (emulator only) |
| `validate` | `scripts/validate.ts` | Zod check of the JSON kept in the repo (fixture trip and message files) | No |
| `lint` | — | ESLint | — |
| `format` / `format:check` | — | Prettier | — |
| `typecheck` | — | `tsc --noEmit` | — |
| `drafts:pull` | `scripts/drafts-pull.ts` | Exports draft places to `research/` | No |
| `places:push` | `scripts/places-push.ts` | Writes researched places into the trip | Yes |
| `places:reset` | `scripts/places-reset.ts` | Shows what clearing all places would change; `-- --apply` does it | Yes, with `--apply` |
| `research:pull` | `scripts/research-pull.ts` | Exports research requests for a research run | No |
| `research:push` | `scripts/research-push.ts` | Writes research as proposals for review; never changes a place | Yes (proposals only) |
| `maps:check` | `scripts/maps-check.ts` | Checks Google keys and test train routes; `-- --embed` serves the Maps Embed test | No |
| `maps:match` | `scripts/maps-match.ts` | Saves place IDs and coordinates; reports doubtful matches | Yes |
| `maps:refresh` | `scripts/maps-refresh.ts` | Renews coordinates before 30 days; `--all` refreshes all | Yes |

Shared helpers:

- `scripts/admin-db.ts`: Admin SDK Firestore with application default credentials, for `projectId` `itinerary-f990b`.
- `scripts/maps-api.ts`: Places API (New) REST helper, using the script key.

Tests for scripts: `scripts/places-reset.test.ts`, `scripts/research-pull.test.ts`, `scripts/validate.test.ts`.

---

## 22. Testing and quality gates

### 22.1 Test setup

- **Vitest** with **jsdom**, configured in `vitest.config.mts`. Alias `@` → `src`. Tests: `src/**/*.test.{ts,tsx}` and `scripts/**/*.test.ts`.
- **Setup** (`src/test/setup.ts`): jest-dom matchers; Testing Library cleanup after each test; the activity repository replaced with the in-memory `LocalActivityRepository`; `ResizeObserver` stubbed (tooltips need it).
- **In-memory repositories** (`local-*.ts`) and the local Maps service replace Firebase and Google in tests. Nothing in tests touches the real database.
- **Fixture:** `src/test/fixture-trip.json` (made-up trip). Only tests import it.
- **Rules tests:** separate config (`vitest.rules.config.mts`), run on the emulator (§15.3).

### 22.2 Test coverage by area (files with tests)

40 test files in total, including the rules tests: most `src/domain` modules have a `*.test.ts`; `src/lib` has tests for actions, stores, sync hooks, versioning, reset, trip ID, tap limit, catalogue filters and i18n; `src/components` has tests for the app gate, screens, place details and the old-link redirect; `scripts` has three.

### 22.3 Quality gates

From `CLAUDE.md` rule 11, before finishing any change:

```bash
npm run test
npm run validate
npm run lint
npm run build
```

And after changing `firestore.rules`: `npm run test:rules`.

CI runs `test`, `validate` and `build`. Lint and rules tests are manual.

### 22.4 Visual checks

Rule 8: check every screen change at 390px and at 1280px or wider before finishing, and say so if it could not be checked.

---

## 23. Firestore: structure and analysis

This section describes the structure the code and rules define. It holds no real data.

### 23.1 Top-level layout

```
config/
  access                       one document: tripCreators (array of lowercase emails)
users/
  {uid}                        one per signed-in person: language, lastTripId, updatedAt
trips/
  {tripId}                     one per trip (ID generated by Firestore)
    activity/{id}              change log
    cities/{id}                cities
    stays/{id}                 hotel stays
    reservations/{id}          flights, trains, hotels, tours, tickets
    holidays/{id}              holidays and closures
    expenses/{id}              spending
    places/{id}                places (catalogue)
    proposals/{id}             research proposals
    items/{id}                 the plan: one document per stop
    queue/{id}                 legacy links from the old queue (read and delete only)
```

No other top-level collections are used by the app. Everything else is denied.

### 23.2 Trip document (`trips/{tripId}`)

| Field | Type | Notes |
|---|---|---|
| `name` | string (1 to 100) | Trip name. |
| `members` | array of strings (1 to 20) | Lowercase emails. Membership is checked here. |
| `createdBy` | string | Email of the creator. Set at creation only. |
| `createdAt` | ISO datetime string | Set at creation. |
| `updatedAt` | ISO datetime string (≤30 chars) | Set on every update. |
| `budget` | map or absent | `totalJPY` (int ≥ 0 or null), `byCategory` (map of expense category → int ≥ 0), `travellers` (int 1 to 20 or null). |

Only `name`, `members`, `budget` and `updatedAt` may change on update.

### 23.3 Plan items (`trips/{tripId}/items/{itemId}`)

| Field | Type | Notes |
|---|---|---|
| `id` | string (≤ 64) | Equals the document ID. |
| `placeId` | string (≤ 64) | Must point to a place ID (not checked by the rules; the app skips items whose place is missing). |
| `date` | string, 10 chars | `YYYY-MM-DD`. |
| `order` | string (≤ 64) | Fractional-index key within the day. |
| `startTime` | string, 5 chars, or null | `HH:MM`. |
| `durationMin` | int 1 to 1440, or null | |
| `note` | string ≤ 500, or null | |
| `status` | `planned`, `done`, `skipped`, `removed` | |
| `updatedAt` | ISO string (≤ 30) | |
| `legNote` | map or null | `mode` (train, subway, bus, walk, taxi), `minutes`, `fareJPY`, `text` (≤ 200). |

Deletes: only when `status == "removed"`.

### 23.4 Cities (`trips/{tripId}/cities/{id}`)

| Field | Type | Notes |
|---|---|---|
| `id` | string ≤ 64 | Lowercase slug in the app (`^[a-z0-9-]+$` in the Zod schema). |
| `name` | string 1 to 100 | |
| `color` | `#rrggbb` | Used for dots and pins. |
| `archived` | bool | |
| `updatedAt` | ISO string | |

### 23.5 Stays (`trips/{tripId}/stays/{id}`)

| Field | Type | Notes |
|---|---|---|
| `id` | string ≤ 64 | App ID format `cityId-checkIn`. |
| `cityId` | string ≤ 64 | Must match a city (not checked by rules). |
| `hotelName` | string 1 to 200 | |
| `hotelMapsUrl` | string ≤ 500, or null | |
| `lat`, `lng` | number or null | Coordinates. |
| `checkIn`, `checkOut` | `YYYY-MM-DD` | `checkOut > checkIn` enforced by rules. |
| `note` | string ≤ 500, or null | |
| `googlePlaceId` | string ≤ 300, or null | Stored indefinitely (allowed by Google's terms). |
| `locationFetchedAt` | ISO string, or null | Date coordinates were fetched; coordinates expire after 30 days. |
| `locationSource` | `google` or `manual`, or null | |
| `archived`, `updatedAt` | bool, ISO string | |

### 23.6 Reservations (`trips/{tripId}/reservations/{id}`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `type` | `flight`, `train`, `hotel`, `tour`, `ticket` | |
| `date` | `YYYY-MM-DD` | |
| `time` | `HH:MM` or null | |
| `from`, `to` | string ≤ 100, or null | |
| `note` | string ≤ 500, or null | |
| `archived`, `updatedAt` | | |

Booking references and confirmation numbers must not be committed to the repo (CLAUDE.md rule 9). The schema has no field for them, so they can only be typed into the note.

### 23.7 Holidays (`trips/{tripId}/holidays/{id}`)

`date` (`YYYY-MM-DD`), `name` (1 to 100), `kind` (`holiday` or `closures`), `note` (≤ 500 or null), `archived`, `updatedAt`.

### 23.8 Places (`trips/{tripId}/places/{id}`)

The largest record. Grouped:

| Group | Fields |
|---|---|
| Identity | `id` (slug), `cityId`, `name` (1 to 200), `mapsUrl` (≤ 500), `source` (`catalog` or `queue`), `status` (`draft` or `researched`) |
| Location | `lat`, `lng` (or null), `googlePlaceId`, `locationFetchedAt`, `locationSource` |
| Classification | `category` (`lights`, `food`, `shopping`, `sight`, `daytrip`, `temple`), `priority` (`must`, `want`, `maybe`) |
| Content | `purpose` (≤ 1000), `description` (≤ 3000), `tips` (array ≤ 30), `notes` (≤ 2000), `websiteUrl` (https, ≤ 500) |
| Practicalities | `costEstimateJPY` (int ≥ 0), `durationMin` (int > 0), `openingHours` (≤ 500), `closedDates` (array ≤ 60 of dates), `seasonFrom`, `seasonTo` (dates), `verifiedAt` (date) |
| Transport | `nearestStation` (map: `name`, `lines` (≤ 8), `walkMin`) |
| Research | `sources` (array ≤ 60 of `{ field, url }`), `lockedFields` (array ≤ 40) |
| Lifecycle | `archived`, `updatedAt` |

Null means "not researched yet", not "free" or "none".

### 23.9 Expenses (`trips/{tripId}/expenses/{id}`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `title` | string 1 to 200 | |
| `amountJPY` | int ≥ 0 | Whole yen. |
| `category` | `flight`, `booking`, `transport`, `food`, `souvenirs`, `attractions`, `clothes`, `temples`, `other` | |
| `date` | `YYYY-MM-DD` | |
| `status` | `planned` or `paid` | Planned = agreed, not yet paid. |
| `paidBy` | string ≤ 254, or null | Email or name. |
| `placeId`, `reservationId`, `stayId` | string ≤ 64, or null | Links to what it pays for; those are not estimated again. |
| `note` | string ≤ 500, or null | |
| `archived`, `updatedAt` | | |

### 23.10 Proposals (`trips/{tripId}/proposals/{id}`)

| Field | Type | Notes |
|---|---|---|
| `id`, `placeId` | string ≤ 64 | |
| `status` | `requested`, `ready`, `applied`, `dismissed` | |
| `fields` | map ≤ 20 entries | Proposed values (see §20 for the list). |
| `sources` | array ≤ 60 of `{ field, url }` | URLs must be https. |
| `notes` | string ≤ 2000, or null | |
| `requestedAt`, `updatedAt` | ISO strings | |

Deletes: only when `status` is `applied` or `dismissed`.

### 23.11 Activity (`trips/{tripId}/activity/{id}`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Equals document ID. |
| `at` | ISO string (≤ 30) | Used for ordering (`orderBy("at", "desc")`). |
| `device` | string 1 to 40 | Name of the device. |
| `kind` | one of 11 kinds (§8.4) | |
| `targetId` | string ≤ 64, or null | Record the change was about. |
| `summary` | string 1 to 300 | Short text written with `t()` when the change happens, so it stays in the language the writer used. |
| `before`, `after` | JSON string ≤ 4000, or null | Snapshot of a plan item for undo. |

Created once; never updated. Members can delete.

### 23.12 Users (`users/{uid}`)

| Field | Type | Notes |
|---|---|---|
| `language` | `en`, `es`, or null | |
| `lastTripId` | string ≤ 128, or null | Trip to open next time. |
| `updatedAt` | ISO string | Required by the rules. |

Only the owner can read or write it.

### 23.13 Config (`config/access`)

One document. `tripCreators`: array of lowercase emails. Readable only by those people; written only in the console.

### 23.14 Entity relationships

```
config/access ──(creators)──► trips (create)

users/{uid}.lastTripId ──► trips/{tripId}

trips/{tripId}
 ├─ members[] ──────────────── who can read and write everything below
 ├─ budget (map)
 ├─ cities/{cityId} ◄──┐
 │   ▲                 │ cityId
 ├─ stays/{cityId-checkIn} ──► checkIn/checkOut → derived days (not stored)
 ├─ places/{placeId} ◄─┬─ cityId
 │   ▲                 │
 │   │ placeId         │ placeId
 ├─ items/{itemId} ────┘ (date → day; order → position)
 ├─ proposals/{id} ──► placeId
 ├─ reservations/{id} ── date
 ├─ holidays/{id} ── date
 ├─ expenses/{id} ── placeId | reservationId | stayId (optional)
 ├─ activity/{id} ── targetId (item, place, stay …)
 └─ queue/{id} (legacy, no links enforced)
```

Days are **not stored**. `deriveDays` builds them from stays, so a day exists while a stay covers it.

Cross-collection links are **not enforced** by the rules or by the database. The app tolerates broken links: a plan item whose place is missing is skipped, and archived places stay findable so old items keep their names (`usePlacesById`).

### 23.15 Access patterns

| Who | Query | Frequency | Notes |
|---|---|---|---|
| Signed-in person | `trips` where `members array-contains email` | Once per session, and on change | Single-field query. Works without a composite index. |
| Signed-in person | `config/access` get | Once | Decides the "New trip" button. |
| Member | `trips/{id}` get (live) | While trip is open | Membership check; live so removal is noticed. |
| Member | six collection listeners, full collections | While trip is open | No pagination; the whole trip is loaded. |
| Member | `items` listener | While trip is open | Plan. |
| Member | `proposals` listener | While trip is open | Research notice and review. |
| Member | `activity` orderBy `at` desc, limit 50 | Only while the activity sheet is open | Single-field order; no composite index. |
| Member | `activity` count and `queue` list | Only in Clean up | `getCountFromServer`, `getDocs`. |
| Member | `users/{uid}` get and merge-set | Sign-in and trip change | Profile. |

The app needs **no composite indexes**. There is no `firestore.indexes.json` in the repo; the Firebase console has none to publish.

### 23.16 Write patterns

- Each change writes **the whole document** (`setDoc`), so the rules see every field.
- Plan changes write only the changed items.
- Bulk writes use `writeBatch` in chunks of 450.
- Trip-level writes: `updateTrip` (name, members, budget).
- Activity writes are fire-and-forget; they never block a change.

### 23.17 Validation layers

| Where | What |
|---|---|
| Rules | Field whitelist (`keys().hasOnly`), required fields (`hasAll`), types, sizes, enums, document ID equals `id`, date string lengths, cross-field checks (`checkOut > checkIn`). |
| App read | Zod schema per collection; a bad row is skipped, not shown as an error. |
| App write | Zod schema in `src/domain/schemas.ts`; forms validate before save. |
| Repo JSON | `scripts/validate.ts` checks the fixture and message files only. |

### 23.18 Observations (for whoever changes the database)

These come from reading the code, not from a live database.

1. **Rules cost.** Every rule check that calls `get()` (membership and trip creators) reads another document. Firestore bills those reads. A busy listener set costs one extra read per document in each snapshot. For a trip-sized dataset this is small, but it grows with listener count, not data size.
2. **Full-collection listeners.** Each collection is listened to in full. Fine at trip scale; it would not scale to many thousands of records.
3. **No cross-reference checks.** `placeId`, `cityId`, `stayId` and friends are not checked. Broken references are handled in the app, not stopped at the database.
4. **Dates and times are strings.** `date`, `checkIn`, `checkOut` and `updatedAt` are strings, not Firestore timestamps. They sort correctly only because the format is fixed (`YYYY-MM-DD`, ISO datetimes); keep that format if they are ever queried by range.
5. **Legacy `queue` collection.** Still in the rules and Clean up, but the app no longer writes to it.
6. **Activity text language.** `summary` is written in the writer's language at the time, so one log can mix English and Spanish.
7. **Activity deletion by members.** Only Clean up is meant to delete activity; the rules let any member delete an entry directly.
8. **`items` placeId is not checked** against the places collection, so a stop can point to a missing place.
9. **Trip-wide budget** sits on the trip document, so any member can change it; there is no per-person budget.
10. **Member list lock-out guard** only checks that the saver is in the list; any member can add or remove others.
11. **Unbounded growth:** activity and expenses have no retention limit; Clean up is manual.
12. **Schema drift risk:** Zod schemas and rules list the same fields by hand. A new field must be added in both, in `firestore.rules` and in `schemas.ts`, or writes fail or data is skipped on read.

---

## 24. Known gaps and stale files

| Item | Status | What to do |
|---|---|---|
| `Trip Planner — Feasibility & Build Plan.md` (repo root) | Superseded. It says there is no Google Maps and that editing is open to anyone with the link; both are now false. | Move to an archive folder or delete, with the owner's say-so. |
| `docs/remaining-work-plan.md` | Dated plan with target dates in November and December 2026. | Update when the work is done or retire it. |
| `links/nagoya.txt` | Seven short Google Maps links. No code or script reads it. | Keep as input for a future matcher, or delete. |
| `components.json` vs code | Declares `iconLibrary: phosphor`, but 29 files use lucide and 9 use Phosphor. | Pick one icon set. |
| `cn` npm package | Used instead of the usual `clsx` and `tailwind-merge` pair. | Works; note it when adding shadcn components. |
| Rules not in CI | `test:rules` and `lint` are not run by the deploy workflow. | Add to CI if wanted. |
| `firestore.rules` not deployed by CI | Must be pasted into the Firebase console. | Keep in the release steps (README). |
| App Check | Code present; off. | Turn on with a reCAPTCHA v3 key once the site is stable. |
| Shadcn sidebar mobile sheet | Has no trigger in the app; never opens on phones. | Intentional (the Days page covers it), or remove the sheet path. |
| Day-side-panel and day-plan | `day-plan.tsx` is a large file with several concerns. | Split when next changed. |
| Tests in `src/app/days/` | A test sits beside its page instead of with the components. | Move if the layout is tidied. |

---

## 25. Glossary

| Term | Meaning in this project |
|---|---|
| **App Router** | Next.js routing by folders under `src/app`. |
| **Static export** | `next build` writes plain HTML, CSS and JS to `out/`. No server runs. |
| **Server Component** | Renders on the server at build time. Pages are these; they render shells only. |
| **Client Component** | Has `"use client"`; runs in the browser. All data code is here. |
| **basePath** | `/itinerary-app`: every URL starts with it. |
| **trailingSlash** | URLs end in `/`. |
| **Zustand store** | A small global state object (`useTripStore`, `usePlanStore`, `useAuthStore`). |
| **Repository** | An interface (`TripRepository`) and its Firestore or in-memory implementation. |
| **Listener / snapshot** | A live Firestore subscription (`onSnapshot`) that delivers the whole list on each change. |
| **Access** | The signed-in person's state for the open trip: `checking`, `member`, `denied`, `missing`. |
| **Member** | An email in a trip's `members` array. |
| **Archived** | A trip record hidden from screens but kept (never deleted in normal use). |
| **Removed** | A plan item marked gone but kept, so it can be restored. |
| **Proposal** | Research waiting for a person to accept or dismiss. |
| **Research run** | The outside process that fills proposals (`docs/research-run.md`). |
| **Fractional index** | A sort key that can always be placed between two others, so moving one item rewrites one key. |
| **Leg** | The trip between two consecutive stops on a day (walk, transit, taxi). |
| **Waiting list** | Places in the trip not yet placed on a day. |
| **Tap limit** | A per-device daily cap on paid Google calls. |
| **Precache** | Files the service worker stores at install so the app works offline. |
| **Version gate** | The start-up check that resets a device when a new version is deployed. |
| **Clean up** | The only place where records are deleted for good. |
| **Haiku subagent** | A helper run on the Haiku model that writes doc updates (rule 16 in `CLAUDE.md`). |
