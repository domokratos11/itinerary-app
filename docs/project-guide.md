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
- **What it does:** shows the trip day by day (cities, hotels, stops, transport, costs), lets members plan each day, keeps a budget, stores reservations, flights and holidays, keeps shared to-do lists, and keeps a change log with undo.
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
| **IBM Plex Sans**, **Barlow Semi Condensed** and **Geist Mono** (via `next/font/google`) | — | Text font (IBM Plex Sans), heading font for headings, dates, times and amounts (Barlow Semi Condensed, weights 500, 600, 700), and monospace font (Geist Mono). Downloaded at build time and served from the site, so they work offline. Japanese falls back to system fonts. | `src/app/layout.tsx` |

### 2.2 UI kit and interaction libraries

| Library | Version | What it does here | Where |
|---|---|---|---|
| **shadcn/ui** | CLI ^4.23.0 | Source-owned components copied into the repo. Style `radix-luma`, base colour `stone`, CSS variables on, RSC on. | `src/components/ui/` (27 files), `components.json` |
| **radix-ui** (umbrella package) | ^1.8.1 | Accessible primitives under shadcn components (dialog, select, tabs, tooltip, dropdown, switch, etc.). | `src/components/ui/*` |
| **class-variance-authority** | ^0.7.1 | Variant styles for buttons, badges and similar components. | `src/components/ui/button.tsx` and others |
| **cn** (npm package) | ^0.5.0 | The `cn()` class-merging helper. Note: shadcn usually ships `clsx` + `tailwind-merge`; this repo uses the `cn` package instead. | `src/lib/utils.ts` re-exports it |
| **lucide-react** | ^1.63.0 | Icons. The only icon set in the app, including the shadcn/ui components (`components.json` sets `iconLibrary: "lucide"`). | many components, `src/components/ui/` |
| **cmdk** | ^1.1.1 | The command menu behind the search palette (`Command`, `CommandDialog`). | `src/components/ui/command.tsx`, `search-palette.tsx` |
| **vaul** | ^1.1.2 | Bottom drawers on phones (`Drawer`). | `src/components/ui/drawer.tsx`, `place-details.tsx`, `edit-panel.tsx`, `add-to-day.tsx` |
| **sonner** | ^2.0.8 | Toast messages. Sits above the bottom tab bar on phones. | `src/components/ui/sonner.tsx`, root layout |
| **embla-carousel-react** | ^8.6.0 | Carousel for Google photos. | `src/components/ui/carousel.tsx`, `place-live.tsx` |
| **recharts** | ^3.8.0 | Budget and dashboard charts (bars, donut, gauge), wrapped by shadcn `chart`. Loaded on first use through `charts-lazy.tsx` (`next/dynamic`, `ssr: false`), so it is not in any page's first load. | `src/components/charts.tsx`, `charts-lazy.tsx`, `ui/chart.tsx`, `budget-screen.tsx`, `dashboard-screen.tsx` |
| **@dnd-kit/core**, **sortable**, **utilities** | ^6.3.1 / ^10.0.0 / ^3.2.2 | Drag and drop of stops within a day, between days, and from the waiting list. Pointer and keyboard sensors. | `day-plan.tsx`, `day-plan-stop.tsx`, `use-day-plan-actions.ts`, `day-side-panel.tsx`, `drop.ts` (domain) |
| **fractional-indexing** | ^4.0.0 | Sort keys for plan items, so moving one stop changes only that item. | `src/lib/order.ts` |
| **Zod** | ^4.6.7 | Runtime schemas. Used to validate every Firestore document on read, the bundled sample trip, the message files, the research files and the backup file. | `src/domain/schemas.ts`, `user-repository.ts`, `proposals.ts`, `backup.ts`, `scripts/validate.ts` |

Charts are the only large library kept out of the first load. Measured first-load JS (gzip, scripts in the exported HTML): Dashboard 706 -> 600 KB, Budget 693 -> 586 KB, Days unchanged at about 591 KB. The recharts code is still precached by the service worker, so charts work offline (§17.2).

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
| **Open-Meteo** (REST, no key) | — | Forecast, typical weather and city geocoding for the day views. Called from the browser; nothing is stored in Firestore. | `src/lib/open-meteo.ts`, `use-weather.ts` |
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
 ├─ ShareRepository interface (src/domain/share-repository.ts)
 │     └─ FirestoreShareRepository (src/lib/firestore-share-repository.ts) ── shares/… (members)
 ├─ Read-only viewer (?share=): viewer-store ── use-share-sync ── getViewerDb()
 │     └─ second Firebase app "viewer" (no sign-in, memory cache) ── shares/{id} and its copy
 ├─ Open-Meteo (src/lib/open-meteo.ts, use-weather.ts) ── forecast, typical weather, geocoding (no key, no Google data)
 └─ service worker (sw.js, precache) and version check (version.json)

Node scripts (scripts/*.ts, run with tsx)
 ├─ firebase-admin (scripts/admin-db.ts) ── Firestore (bypasses rules)
 └─ REST calls (scripts/maps-api.ts) ── Google Places API (New) and Routes API
```

The rule that holds this together: **screens never import the Firebase SDK or the Maps SDK directly.** They call hooks and actions, which call interfaces (`TripRepository`, `PlanRepository`, `ProposalRepository`, `UserRepository`, `ActivityRepository`, `CleanupRepository`, `ShareRepository`, `MapsService`). Tests swap in the in-memory versions (`local-*.ts`).

Read-only links are the one place the browser reads without sign-in. The viewer path never calls `getDb()`, which throws in viewer mode, so a link cannot reach the real trip (§12.8).

---

## 3. Project structure

### 3.1 Top level

| Path | What it is |
|---|---|
| `src/` | All application code and tests. |
| `scripts/` | Node scripts for data, research and Maps work. Run with `tsx`. |
| `tests/rules/` | Firestore security rules tests (emulator). |
| `docs/` | Operational docs: Maps setup and plan, research run guide, and this guide. |
| `public/` | Static files copied as-is: icons, `.nojekyll` (so GitHub Pages serves `_next/`), Google Maps logo. |
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

### 3.2 `src/app`: routes

| File | Route |
|---|---|
| `layout.tsx` | Root layout for every page (fonts, metadata, providers, gates, header, sidebar, tab bar). |
| `error.tsx` | Crash screen for any page (Client Component). Shown inside the root layout, so the header, sidebar and tab bar stay. Buttons: "Try again" (`retry()`) and "Go to Dashboard" (`/`, keeps `?trip=`). |
| `global-error.tsx` | Crash screen for the root layout itself (Client Component). Replaces the whole document, so it renders its own `<html>` and `<body>`, imports `globals.css` and applies the saved dark theme from `localStorage.theme`. Buttons: "Try again" and "Reload app". |
| `page.tsx` | `/`: Dashboard. |
| `days/page.tsx` | `/days/`: the list of days, with trip header, today card, notices and the day list. |
| `day/page.tsx` | `/day/?date=YYYY-MM-DD`: one day. One static page for all dates. |
| `cities/page.tsx` | `/cities/`: all cities in trip order. |
| `city/page.tsx` | `/city/?id=<cityId>&place=<placeId>`: one city's places. |
| `budget/page.tsx` | `/budget/`: spending and budget. |
| `todos/page.tsx` | `/todos/`: shared to-do lists. `?list=<id>` opens one list. Server Component shell around `TodosScreen`. |
| `settings/page.tsx` | `/settings/`: trip administration. |
| `not-found.tsx` | 404 page. Also `404.html` on Pages, where old day and city links are redirected (`old-link-redirect.tsx`). |
| `manifest.ts` | `manifest.webmanifest` (installable app). |
| `version.json/route.ts` | `version.json` with the deployed version. `force-static`, so no request is read. |
| `globals.css` | Theme tokens (hex): eight blocks, one per colour family and mode (Sen, Ink, Pine and Plum, each light and dark), each with the same token names, including the category, priority, spending and map-pin colours (§10). Tailwind import, dark variant, base styles, and the `thin-scrollbar` utility (replaces shadcn's `no-scrollbar`). |
| `favicon.ico` | Browser icon. |
| `days/page.test.tsx` | A test kept beside its page. |
| `error.test.tsx` | Test for the crash screen in `error.tsx`, kept beside it. |

Every page file is a Server Component that renders a `main` wrapper and one client screen component inside `Suspense`. The page itself reads no data. Every route also accepts `?share=` for the read-only view (§5, §12.8).

### 3.3 `src/components`: UI

Shared chrome and gates:

| File | Role |
|---|---|
| `app-gate.tsx` | Shows the splash, sign-in, trip picker, "not on this trip", "This link isn't open" (viewer mode) and offline screens. Renders the app only when access is `member`, every trip collection has answered, the plan store has answered (`ready` or `error`), or when a shared view is active. While the trip list has answered with trips but none is chosen yet, it keeps the splash (offline: the offline screen), so "No trips yet" or the picker does not flash first. |
| `app-header.tsx` | Top bar (trip switcher, section links on tablets, `SyncStatus`, search, activity, account; in viewer mode the trip name, a "Read-only" badge, search and the viewer sheet in place of Activity and Account). Exports `BottomNav` (phone tab bar), `VersionTag` (desktop corner text), `SECTIONS` (the six sections, including To-dos) and `useSections()`, which gives viewers only Dashboard, Days and Cities. |
| `viewer.tsx` | `ViewerSheet` (side sheet: language, theme and colour family, "Leave shared view", stored on the device only) and `NotOnSharedView` (shown on `/budget/` and `/settings/` in viewer mode). |
| `app-sidebar.tsx` | Left sidebar on wide screens: sections and every trip day with city colour dots and stop counts. Its content scrolls in both the expanded and icon-rail states, with the slim `thin-scrollbar` (`SidebarContent` in `ui/sidebar.tsx`). |
| `version-gate.tsx` | Runs first: sets the language, clears storage from an older version, checks for a newer deploy. |
| `plan-sync.tsx` | Mounted once. Renders `MemberSync` (auth, plan and trip listeners) for members, or `ViewerSync` (loads the shared copy, §12.8) when the tab is in viewer mode. |
| `locale-root.tsx` | Remounts the app when the language changes. |
| `service-worker-register.tsx` | Registers `sw.js` in production. |
| `offline-banner.tsx` | Shows "offline" text (`useOnline`) and, when writes are waiting, the count from `useSyncStore`; edits still save on the device. |
| `sync-status.tsx` | `SyncStatus`: icon button in the header, left of search, hidden on read-only links. Shows whether edits have reached the server (§17.1): cloud-check "All changes saved" (muted), cloud-upload "Saving N changes…" (pulsing), cloud-off "N changes waiting for a connection." (`text-warning`, offline with pending writes). Tooltip on hover or focus; a tap shows the same text in a toast, since tooltips do not open on tap. |
| `theme-provider.tsx`, `theme-toggle.tsx` | Theme state and the Light / Dark button. `theme-provider.tsx` also puts the saved colour family on the page (`PickPalette`) and re-applies the browser bar colour (`ThemeColor`). |
| `palette-picker.tsx` | Colour family picker (Sen, Ink, Pine, Plum): shadcn ToggleGroup, two per row on phones and one row from `lg`. Sits under the Light / Dark toggle in the Account sheet and the viewer sheet. |
| `search-palette.tsx` | The Ctrl+K / ⌘K search over days, hotels and places. |
| `trip-switcher.tsx`, `new-trip.tsx` | Trip name menu; panel to create a trip (for permitted creators). |
| `account-sheet.tsx` | Account side sheet: signed-in email, theme (Light / Dark and colour family), language, About, sign-out. |
| `activity-sheet.tsx` | Change log sheet with undo. |
| `language-select.tsx` | Language picker. |
| `trip-name.tsx`, `trip-dates.tsx`, `trip-plan-status.tsx` | Small trip header pieces. |
| `old-link-redirect.tsx` | Forwards old `/day/2026-…/` and `/city/nagoya/` links to the query-string form. |
| `error-screen.tsx` | `ErrorScreen`: the shared card for the crash screens (`error.tsx`, `global-error.tsx`). Shows a title and text (`error.*` keys), the buttons passed in, and logs the error with `console.error`. Uses `role="alert"`. |

Screens (one per page):

| File | Page | Role |
|---|---|---|
| `dashboard-screen.tsx` | `/` | `DashboardScreen` and `DashboardContent`: dashboard tiles and charts: days to go, trip length, stops today, budget, next reservation, stay tonight, warnings, places to research, and open to-dos that are late or due soon (§12.9). Imports the budget figures from `budget-figures.tsx`. |
| `dashboard-parts.tsx` | `/` | The pieces the dashboard is built from: `Tile`, `Panel`, `Hint`, `Empty` and `ClockTiles`. |
| `today-card.tsx` | `/` and `/days/` | Today in Japan: during the trip shows the day and the next stop with directions, and the quick cost button (`QuickExpenseButton`); before it, a countdown. During the trip it also shows the day's weather (`WeatherBadge`). |
| `trip-days.tsx`, `needs-new-day.tsx`, `research-notice.tsx` | `/days/` | Day list with each day's flights, and flights leaving on dates no stay covers; stops left without a valid day after stays changed; research results waiting for review. `trip-days.tsx` holds the Calendar / List toggle (shadcn `ToggleGroup`, next to Today). |
| `trip-calendar.tsx` | `/days/` | `TripCalendar`: the Calendar view. Monday-first weeks in one continuous grid (December into January). Trip days link to `/day/?date=` (id `day-YYYY-MM-DD`); cells show the day number, stop count, a flight icon, a holiday dot and a today ring. Each hotel night is a city-coloured bar; hotel names show from `lg`. Days outside the trip are muted, not links. A day with research requested shows a search icon; one with a ready analysis shows a sparkles icon. Each trip day cell also shows the day's weather icon (`WeatherBadge`), with the high from `lg`. |
| `day-screen.tsx` | `/day/` | Loads one day and renders `DayPlan`. |
| `day-plan.tsx` | `/day/` | `DayPlan` (about 630 lines), with `DroppableList`, `PhoneWaiting` and the drag collision helpers. The day itself: flight cards at the top, stops, legs, costs, warnings, map (with the Show hotel control in `map-hotels.tsx`), waiting list, drag and drop. Stops and links are in the two files below, and the drag and stop actions in `use-day-plan-actions.ts` (§3.5). |
| `day-plan-stop.tsx` | `/day/` | `SortableStop` (wide screens, drag grip), `StopCard` (a row on the day's line: the name and badges always show, and a chevron opens the actions: status buttons, map link, move day, cost, remove; phones get up and down buttons), `LINE_ITEM` (the class for each list item, which draws the rail) and the `StopOutcome` type. |
| `day-plan-links.tsx` | `/day/` | `FullDay` (directions for the whole day), `HotelButtons` and `HotelButton` (directions to the hotel), `BookingsButton` (wide screens, side sheet) and `Reservations`. |
| `day-research.tsx` | `/day/` | `DayResearchPanel`: under the flights. "Research this day" (optional message) asks for every place on the day; shows the request, the day analysis (starts collapsed to a header and a short preview; once opened: load badge, warnings, nearby ideas, answer, sources) and place updates to review or accept for the day. Hidden on read-only links. |
| `day-side-panel.tsx` | `/day/` (wide) | The columns of the day view on wide screens: the stops on the left at full height; on the right, the Waiting column and a compact "Move to another day" column above the map. `WaitingControls` gives the waiting list its sort, filter, Clear and Show on map controls. Also drag IDs. |
| `map-hotels.tsx` | `/day/` | `MapHotelsControl`: the **Show hotel** checkbox in the map toolbar, off by default. On a moving day with two different hotels, a multi-select picks the morning and night hotel. |
| `city-screen.tsx` | `/city/` | Loads one city and renders `CityCatalog`. |
| `city-catalog.tsx` | `/city/` | Place catalogue: list or map, filters, Days filter (per-day pins with a legend), add place, cost and details. |
| `cities-screen.tsx` | `/cities/` | Cities, dates, and how much of each is planned. |
| `budget-screen.tsx`, `expense-form.tsx`, `yen.tsx`, `cost-line.tsx`, `leg-line.tsx` | `/budget/` | `BudgetScreen` and `BudgetContent`: expenses (with filters and sort), the "Against each person" card, the Cash card, totals by category, charts, gauge. The expense form asks for the payment method (card or cash) and the payer, which is always a member. `ExportExpensesButton` (in `budget-parts.tsx`, header, shown when there are expenses) downloads the CSV. `yen.tsx` formats amounts and holds the hide-amounts eye button (`HideAmountsButton`), the currency button (`CurrencyButton`) and `MoneyScope` (hidden, currency and rate). `Yen` and `useYenValues` show dollars when USD is chosen. The expense form puts a new expense in the city of that night (`nightStay`) unless the prefill gives one; editing keeps the expense's own `cityId`. |
| `budget-figures.tsx` | `/budget/` and `/` | `useBudgetFigures`, `categorySeries`, `spentPercent`, `GaugeCenter`, `Figure` and `SummaryFigures`. The Dashboard imports these from here, not from the Budget screen. |
| `budget-parts.tsx` | `/budget/` | `TargetRow`, `MemberTargetRow` (one row per member: paid against their target, planned below), `ExpenseRow` (shows the payer and card or cash), `BudgetForm` (total, categories, travellers, per-person targets) and `ExportExpensesButton`. |
| `budget-person.tsx` | `/budget/` | `PersonPanel`: one member's details. A side Sheet from 768px, a bottom Drawer on phones. Shows paid, planned, paid by card, paid in cash, their cash on hand, paid by category and their expenses (editable), with a button to filter the list to that person. |
| `cash-section.tsx` | `/budget/` | `CashSection`: the Cash card. Lists withdrawals and handovers, with add, edit and archive. Shows each member's cash on hand, the total withdrawn with dollars charged (and how many withdrawals still lack dollars), and who owes whom. |
| `quick-expense.tsx` | `/` (Today card) and `/day/` | `QuickExpenseButton({date?})`: a large "+ ¥" button (aria "Log a cost"), shown during the trip on today's date and in the day page's button row. Opens an `EditPanel` with a big numeric amount field (`AmountInput`, with the ¥/$ toggle), a card or cash choice (the last one used is preselected), a 4-column grid of category tiles (the last one used is preselected), an optional "What" line and "More details", which opens the full `ExpenseForm` with the same values. Save writes through `saveRecord`; the toast offers Undo. Hidden on read-only links. |
| `amount-input.tsx` | Today card and day page (quick cost), expense form (`/budget/`), reservation form (`/settings/`) | `AmountInput`: an amount box with a ¥/$ toggle. In dollars it shows an editable rate (it starts at today's rate from `useUsdRate`) and the yen result. |
| `settings-screen.tsx` | `/settings/` | Tabs: Stays, Cities, Places, Flights, Bookings, Holidays, Trip, Share, Backup, Clean up. |
| `settings-share.tsx` | Settings tab | Read-only share links: create, copy, refresh, change expiry, close (§12.8). |
| `settings-stays.tsx`, `settings-cities.tsx`, `settings-places.tsx`, `settings-flights.tsx`, `settings-reservations.tsx`, `settings-holidays.tsx`, `settings-trip.tsx` | Settings tabs | Admin editors for each collection. `settings-places.tsx` also holds the research requests and proposal review. |
| `settings-backup.tsx` | Settings tab | Export the whole trip as JSON; import only into an empty trip. |
| `settings-cleanup.tsx` | Settings tab | Lists retired records and deletes them for good, including archived to-dos and to-do lists that no live to-do uses. |
| `settings-about.tsx` | Account sheet | Version and "start fresh" button. |
| `todos-screen.tsx` | `/todos/` | `TodosScreen`: the list column (wide) or list Select (phone), the to-do rows, filters, sort and list progress (§12.9). |
| `todo-forms.tsx` | `/todos/` | `ListForm` and `TodoForm`, both shown in `EditPanel`. |

Plan and place editing:

| File | Role |
|---|---|
| `place-details.tsx` | Place sheet (wide) or drawer (phone): photo gallery at the top, notes, live details, and a three-column grid of outline buttons, most with one short word (`place.short*` messages: Maps, Locate, Add, Cost, Research, Review or Requested, Edit). The full wording stays as each button's accessible name and tooltip. Buttons: Open in Google Maps, Show on map, Add to day, Log cost, Research, Edit and Archive. "Show on map" appears only when the place has coordinates (`onShowOnMap`). `AddToDay` takes `variant`, `className` and `compact` (the one-word button) for its button. |
| `place-live.tsx` | `PlaceLive` (rating and today's hours) and `PlacePhotos` (photo gallery). No buttons: each loads by itself when a place opens. When no photo can show, the area says why: the device's daily photo limit is reached (it resets at midnight Tokyo time), Google did not answer, Maps is not set up or its key was refused, or the place has no photos. A photo that fails to load shows "This photo couldn't load" and logs a console warning. |
| `place-editor.tsx` | Form for a place's fields. |
| `edit-panel.tsx` | Dialog (wide) or drawer (phone) that wraps forms. |
| `add-place.tsx` | Add a place by name (Google suggestions) or by pasted Maps link. |
| `place-suggestions.tsx` | The list of Google's suggestions, used by `add-place.tsx` and `settings-stays.tsx`. |
| `add-to-day.tsx` | Choose day and position for a place. |
| `proposal-review.tsx` | Compare old and new values for a research proposal, accept field by field. |
| `trip-map.tsx` | Google map through `MapsService`: pins, routes, theme-aware. Pin colours are `var(--…)` tokens, resolved to real colours by `lib/css-color.ts` before drawing; the map redraws when the pins, lines, colour family or light/dark mode change. "Show all pins" icon button (Maximize, top-right, once the map is ready with pins) calls `fit()`. Props: `focus?: MapFocus \| null` (`{id}`, a new object per request, applied after redraws and once a new map is ready) and `overlay` (drawn bottom-left, used for a legend), and `toolbar` (controls drawn top-left, kept in full screen). Every map has a full-screen button (Expand / Shrink): full screen grows the same map box to the whole screen, with safe-area padding and no second map load, locks page scroll, closes with Escape or the button, and refits the pins. |
| `flight-card.tsx` | `FlightCard`: one flight as printed on the ticket, with its route, dates and times (each in its airport's local time), confirmation and note. Used on the Days and Day pages and in Settings → Flights. |
| `day-weather.tsx` | `DayWeatherStrip` (day page header: icon and name, high and low, chance of rain or snow, Forecast or dashed Typical tag, sunrise and sunset) and `WeatherBadge` (icon, plus the high from `lg`; used on the Today card and calendar cells). `WEATHER_ICON` maps kinds to icons. Data from `use-weather.ts`. |
| `tag-badges.tsx` | Category and priority badges and options. Quiet: a neutral badge (`secondary` for category, `outline` for priority) with the icon in the category or priority colour; the badge is not filled with that colour. |
| `charts.tsx` | The recharts charts only: `DonutChart`, `BudgetGauge`, `ColumnChart`, `StackedColumnChart`. Not imported by screens directly. `configFor()` gives each series one colour for light and dark (§10). |
| `chart-parts.tsx` | Chart pieces drawn without recharts: `Series` type, `SeriesLegend`, `BarList` and an internal `ChartValue`. |
| `charts-lazy.tsx` | What screens import. Wraps the four recharts charts with `next/dynamic` (`ssr: false`), each with a `Skeleton` of the chart's own size so nothing moves, and re-exports `BarList`, `SeriesLegend` and `Series`. Used by `dashboard-screen.tsx` and `budget-screen.tsx`. |

Base components:

| Folder | Role |
|---|---|
| `src/components/ui/` | 27 shadcn/ui components. Do not hand-edit; add with `npx shadcn@latest add <name>`. Files include `alert-dialog`, `button`, `card`, `carousel`, `chart`, `command`, `dialog`, `drawer`, `dropdown-menu`, `select`, `sheet`, `sidebar`, `sonner`, `tabs`, `toggle-group`, `tooltip`, and others. |

### 3.4 `src/domain`: pure logic and interfaces

No React, no Firebase, no current language. Functions that need words take a `Translate` parameter. This is the layer to unit-test.

| File | Role |
|---|---|
| `schemas.ts` | The Zod schemas for every Firestore record and the enums (categories, priorities, statuses, expense categories, reservation types, payment methods, cash kinds). `CashRecordSchema` is the cash record; `ExpenseRecordSchema` has `paymentMethod` (default `card`); `BudgetSchema` has `byMember`. `TodoListRecordSchema` and `TodoRecordSchema` hold the to-do records (§23.22). |
| `cash.ts` | `summarizeCash(cash, expenses, members)`: each member's cash on hand (withdrawn + received − handed over − paid in cash), the total withdrawn with dollars charged, and who owes whom (handovers net out per pair). Pure; never part of the budget totals. |
| `trip.ts` | `TripData` type, `TRIP_COLLECTIONS` (the ten trip collections: the eight record collections, plus `todoLists` and `todos`), `EMPTY_TRIP`, `activeTrip` (hides archived records, sorts), `stayId`, endpoint and stay grouping helpers. |
| `trip-repository.ts` | `TripRepository` interface and `TripAccess` / `TripSummary` types. |
| `plan-repository.ts` | `PlanRepository` interface; `markRemoved`. |
| `proposal-repository.ts` | `ProposalRepository` interface. |
| `user-repository.ts` | `UserRepository` interface and the user profile schema (language, last trip). |
| `activity.ts` | Activity schema, kinds, `ActivityRepository`, and `undoFor`. |
| `cleanup.ts` | Plans the Clean up step (what is retired and can go) and the `CleanupRepository` interface. |
| `backup.ts` | Backup file schema and builder (includes day research and cash records). |
| `day-research.ts` | `DayResearchRepository` interface; `requestDay`, `isOpenDayResearch`, `dayPlaces`, `dayProposals`, `dayBrief`, `DayResultSchema`. Day research: requests and analyses per day, and the day's part of the research file. |
| `plan.ts` | Plan logic: items for a day, next stop, keys for insert, stop warnings, holiday warnings, costs, hotels for a day. |
| `days.ts` | `deriveDays`: the trip's days, from the stays (a day belongs to every stay whose range includes it). `tripPhase` (before, during, after). |
| `legs.ts` | Legs between stops (walk, transit, taxi) and distance formatting. Walking legs are at most `WALK_LEG_MAX_KM` (1.5 km). |
| `drop.ts` | Drop rules for drag and drop (which target, which order key). |
| `location.ts` | Google coordinate expiry (30 days) and refresh (after 20 days); match radii for the place matcher. |
| `live-hours.ts` | Parses Google's opening hours text (English) into periods; "open now". |
| `map-pins.ts` | Map pins, colours and straight lines for the trip map. `dayFilterPins(dates, items, places)` returns `{placeIds, pins, legend}` for the City page's day filter, colouring pins per day (`DAY_COLORS`, in date order). Stop, finished and hotel pins are `var(--pin-…)` tokens (§10). |
| `maps-service.ts` | `MapsService` interface and map types. `MapView` has `fit()` (frame all current pins again) and `focus(id)` (pan to that pin, zoom 16, bring it to the front and scale it up until the next update). |
| `budget.ts` | Budget summary, totals by category and by payer, per-day spending, estimates from places, yen and USD formatting (`formatYen`, `formatUsd`, `formatUsdAt`, `usdToYen`, `parseUsd`, `parseRate`), and the masked amount `HIDDEN_AMOUNT` used while amounts are hidden. `payerOf` gives an expense's payer: its `paidBy`, or the trip's first member when there is none. `totalsByMember` gives each member's paid and planned against their `byMember` target. `personDetails` gives one member's figures for `PersonPanel`. `filterExpenses` applies the status, person, payment and category filters and the sort. |
| `amount.ts` | `AmountEntry` (currency `JPY` or `USD`, amount text, rate text), `readAmount` (turns an entry into `amountJPY`, `originalUSD` and `rateJPYPerUSD`) and `entryFor` (reopens a saved amount). Totals count the whole-yen `amountJPY`. |
| `booking-cost.ts` | `bookingLabel`, `linkedExpense` (the first live expense linked to a reservation) and `bookingExpense`. Used for a reservation's cost (§12.6). |
| `text.ts` | `capitalizeFirst`: raises the first letter of older expense titles when they are shown. |
| `expenses-csv.ts` | `expensesCsv(expenses, {cities, places, person}, tr)`: the expenses CSV for export. Columns date, what, category, amount (JPY), status, paid by, paid with (card or cash), city, place, note, plus amount entered (USD), rate and booking, with translated headers and labels; archived expenses left out; sorted by date then title. UTF-8 BOM, CRLF line ends; cells with commas, quotes or line breaks quoted; text starting with `= + - @` gets a leading apostrophe. |
| `quick-expense.ts` | `QUICK_CATEGORIES` (food, transport, attractions, souvenirs, temples, clothes, other; flights and bookings are logged from their own screens), `parseYen(text)` (digits with commas, spaces or ¥; else null), and `quickExpense({...})`, which builds the record: title = typed text or the category's name; status `paid` when the date is today or earlier (Tokyo), else `planned`; `paidBy` = the signed-in member; `cityId` = the city of that night's hotel; `stayId`, `placeId`, `reservationId` null. |
| `flights.ts` | Flight logic: flights on a day, flights outside the days, next flight, route, cost label, cost in yen, and the form conversion. |
| `share.ts`, `share-repository.ts` | `share.ts`: `newShareId` and `parseShareId` (128-bit base64url IDs), `MAX_SHARE_DAYS` (30), `toSharedTrip` (builds the copy, §12.8). `share-repository.ts`: the `ShareRepository` interface. |
| `waiting-view.ts` | `applyWaitingView`, `isDefaultWaitingView`, `DEFAULT_WAITING_VIEW`, `WAITING_SORTS`: sort and filter for the Day page's waiting list and its pins. |
| `dashboard.ts` | Figures for the dashboard tiles. |
| `todos.ts` | Pure to-do logic: due states (overdue, soon, later, none) in Japan time, `todosDueSoon`, list progress, filter and sort, order keys, status changes that keep `completedAt`, and list archiving. |
| `weather.ts` | `WeatherKind`, `weatherKind(wmoCode)`, `typicalWeather(pastYears)`, `yearsBefore`, type `DayWeather`. Kinds are clear, partly, cloudy, fog, drizzle, rain, snow and storm. Typical weather is the average high and low, the % of years with at least 1 mm of rain, and the most common kind. |
| `sun.ts` | `sunTimes(date, lat, lng)` → sunrise, sunset and daylight minutes in Tokyo time (NOAA solar equations, about a minute's accuracy). |
| `proposals.ts` | Research proposals: new, open check, accept field by field, research result schema and cleaning. |
| `place-edit.ts` | Place form: fields, validation, changes, filters (`PLACE_FILTERS`), Maps link parsing, draft places. |
| `trip-edit.ts` | Stay issues and day changes when stays move. |
| `taxonomy.ts` | Colours for categories, priorities and expenses, as `var(--…)` tokens (§10); `tint()` mixes a colour into `var(--card)`. |
| `version.ts` | `versionFromDescribe`: turns `git describe` output into a version number. |
| `i18n.ts` | `MessageKey` (every text key, from `en.json`), `MessageValues`, `Translate`. |
| `test-place.ts`, `src/test/fixture-trip.ts` | Helpers and the made-up sample trip for tests. |

### 3.5 `src/lib`: browser services, stores, hooks, repositories

Firebase and repositories:

| File | Role |
|---|---|
| `firebase.ts` | Starts the Firebase app (once), App Check (off unless a key is set), and Firestore with a persistent local cache and multi-tab manager. `getFirebaseAuth()` for Auth. `getDb()` throws in viewer mode. `getViewerDb()` is a separate app named "viewer" with a memory cache, used only by the shared view. |
| `firebase.config.ts` | Firebase web config and the App Check site key (`null` = off). Public values; access is decided by the rules. |
| `auth.ts` | The only file that talks to `firebase/auth` for sign-in: Google popup, `watchUser`, sign-out, session clear. `signInWithGoogle()` stops waiting after `SIGN_IN_TIMEOUT_MS` (90 s) and throws "Sign-in didn't finish", so the button can be tapped again; a popup that finishes later still signs in through `onAuthStateChanged`. `signInErrorKey(code, standalone)` maps Firebase codes to message keys, and `isStandalone()` detects the home-screen app (`navigator.standalone` on iOS, or `display-mode: standalone`). |
| `tracked-firestore.ts` | `setDoc`, `updateDoc`, `deleteDoc` and `writeBatch`, with the same signatures as `firebase/firestore`, each wrapped with `trackWrite` so the write counts in `sync-store.ts` until the server confirms (`writeBatch` wraps `commit`). Every `firestore-*-repository.ts` imports these four from here, not from `firebase/firestore`. `watchStartupWrites()` calls `waitForPendingWrites(getDb())` once. |
| `storage-persist.ts` | Asks the browser to keep the offline copy of the trip (IndexedDB). `storageStatus()` returns `kept`, `may-be-cleared` or `unsupported` from `navigator.storage.persisted()`; `requestPersistentStorage()` calls `navigator.storage.persist()` only when the copy is not already kept. Browsers usually decide without a prompt (Chrome by engagement, Safari for home-screen apps). Tests in `storage-persist.test.ts`. |
| `firestore-trip-repository.ts` | Implements `TripRepository` on `trips/…`. Skips rows that fail the schema. Batches writes in chunks of 450. |
| `firestore-plan-repository.ts` | Implements `PlanRepository` on `trips/{id}/items`. |
| `firestore-proposal-repository.ts` | Implements `ProposalRepository` on `trips/{id}/proposals`. |
| `firestore-day-research-repository.ts` | Implements `DayResearchRepository` (`subscribe`, `save`) on `trips/{id}/dayResearch/{date}`. `local-day-research-repository.ts` is the in-memory version for tests. |
| `firestore-user-repository.ts` | Implements `UserRepository` on `users/{uid}`. |
| `firestore-activity-repository.ts` | Implements `ActivityRepository` on `trips/{id}/activity` (newest first, limited). |
| `firestore-cleanup-repository.ts` | Implements `CleanupRepository`: counts, lists and deletes retired records (the only code that deletes), including `removeShare` for closed or expired share links with their copies. |
| `firestore-share-repository.ts` | Implements `ShareRepository` on `shares/{shareId}` and its copy subcollections: `watchShares`, `create`, `publish` (refresh), `setExpiry`, `revoke`, `load`. Refresh writes every record and deletes copies of records that are gone; the trip is not touched. |
| `share-repository-instance.ts` | The single `ShareRepository` instance. |
| `use-shares.ts` | Hook `useShares` for Settings → Share: the trip's share links. |
| `use-share-sync.ts` | For viewer mode: loads the copy once from the server, checks the expiry every minute, re-reads every 10 minutes, and fills `useTripStore` and `usePlanStore`. |
| `viewer-store.ts` | Zustand: `useViewerStore` (status `off`, `loading`, `active`, `closed`, `failed`), `useReadOnly()`, `isViewer()`, `viewerShareId()` (reads `?share=`, kept in sessionStorage for the tab; a `?trip=` link leaves viewer mode), `leaveSharedView`, `shareUrl`. |
| `*-repository-instance.ts` | The single instance each screen uses (`tripRepository`, `planRepository`, and others). |
| `local-*-repository.ts` | In-memory versions for tests (`local-share-repository.ts` included). |

State and sync:

| File | Role |
|---|---|
| `auth-store.ts` | Zustand: sign-in status, user, trips, access, canCreateTrips, trip ID. `useActiveTrip()`. The `tripChosen` flag is set by `setTripId` (also when it sets null) and reset by `setUser`. |
| `use-auth-sync.ts` | Watches sign-in, loads the person's trips and profile, picks a trip, checks membership, remembers the trip. |
| `trip-store.ts` | Zustand: trip collections, loaded flags, error. Hooks `useTrip`, `useTripDays`, `usePlacesById`, `useCitiesById`. |
| `use-trip-sync.ts` | Subscribes to the ten trip collections (`TRIP_COLLECTIONS`, including `cash` and the two to-do collections) when access is `member`. |
| `plan-store.ts` | Zustand: plan items, ready flag, error. |
| `use-plan-sync.ts` | Subscribes to `items` for the trip. |
| `use-day-research.ts` | Hook `useDayResearch(tripId)`: live day research. Listens only once access is `member`. |
| `use-day-plan-actions.ts` | Hook `useDayPlanActions({ tripId, date, items, stops, placesById, citiesById, tripDays })` for the Day page: the dnd-kit sensors (pointer, touch with a 200 ms delay, keyboard), the `dragging` state, `handleDragEnd` (uses `planDrop`), and the stop actions `addToDay`, `stepBy`, `moveToDay`, `remove` and `mark`, each with its toast and Undo. With `tripId` null (read-only link) they do nothing. |
| `sync-store.ts` | Zustand `useSyncStore`: `pending` (writes from this session the server has not confirmed) and `startup` (true until edits queued in an earlier session, before a reload, are sent). `trackWrite(promise)` counts a write until it settles; `trackStartupWrites(promise)` does the same for those earlier edits; `syncStatus(state, online)` returns `"saved"`, `"saving"` or `"waiting"`. Firestore write promises settle only when the server confirms, so offline writes stay counted. |
| `use-proposals.ts`, `use-activity.ts` | Live proposals (always), and the activity log (only while its sheet is open). |
| `use-trip-id.ts` | The open trip's ID from the auth store. |
| `trip-id.ts` | Trip ID format (`[A-Za-z0-9_-]`, 6 to 128 characters), remembering it on the device, choosing a trip, opening trips. |
| `plan-actions.ts` | Every plan change: add, move, re-key, edit, remove, restore. Updates the store first, then saves. |
| `trip-actions.ts` | Every change to trip records (`saveRecord`, `archiveRecord`, `saveBudget`). |
| `proposal-actions.ts` | Request research; accept or dismiss proposals. |
| `activity-log.ts` | Writes activity entries without ever failing the change. |
| `device-name.ts` | The name this device signs its changes with (kept in localStorage). |
| `hide-amounts.ts` | Zustand store `useHideAmounts` and `setHideAmounts`: whether amounts are hidden on Budget and Dashboard. Saved in localStorage under `hide-amounts`, kept through a version reset. |
| `display-currency.ts` | Zustand store for the display currency, `"JPY"` or `"USD"`. Saved in localStorage under `display-currency`, per device. Display only (§12.5). Kept through a version reset. |
| `payment-method.ts` | `lastPaymentMethod()` and `rememberPaymentMethod(method)`: the last card or cash choice, saved in localStorage under `payment-method` (`PAYMENT_METHOD_KEY`), per device. Every expense form starts from it. Kept through a version reset. |
| `lang-boot.ts` | `LOCALE_STORAGE_KEY` (`"locale"`, the localStorage key for the chosen language, also used by `i18n.ts`) and `LANG_BOOT_SCRIPT`, the inline script the root layout puts in `<head>`. It sets `<html lang>` before the first paint: the stored language if valid, else Spanish for an `es*` browser, else English (the same rule as `initLocale`). Tests in `lang-boot.test.ts`. |
| `usd-rate.ts` | Zustand store `useUsdRate`: today's USD to JPY rate, fetched once per session from Frankfurter (§14.4), falling back to the fixed `YEN_PER_USD` offline. Used by the expense, quick cost and reservation forms and by the dollar display. |
| `backup-actions.ts` | Export and import of the trip file. |
| `trip-actions.test.ts` etc. | Tests beside each module. |

Maps and place helpers:

| File | Role |
|---|---|
| `maps.config.ts` | Maps browser key and Map ID. Public values; restricted in Google Cloud. |
| `maps-service-instance.ts` | The one `MapsService` instance. |
| `google-maps-service.ts` | Implements `MapsService` with the Maps JS SDK. Loads the script once. Remembers the last pins drawn, so `fit()` can frame them again. |
| `use-walking-legs.ts` | Walking routes for a day's short legs, kept in memory. |
| `use-place-suggestions.ts` | The debounced search behind `PlaceSuggestions` (add a place and the hotel form). |
| `tap-limit.ts` | Per-device daily limit on paid Google calls (photos and live details, 30 each per day). |
| `place-live-cache.ts` | Keeps live details and photo lists in memory for 30 minutes per place (`LIVE_CACHE_MS`). Never stored, so a reload empties it; failed calls are not kept; only real Google calls count toward the limit. |
| `catalog-filter.ts` | Filters the city catalogue (category, priority, unassigned) and finds nearby places (1 km). |
| `geo.ts` | Straight-line distance. |
| `tokyo-date.ts` | Date helpers in Tokyo time. |
| `format-day.ts` | Day labels, such as "Thursday 17 Dec". `formatTokyoDateTime` gives a date and time in Japan time (used for share expiry). |
| `category-label.ts`, `taxonomy-icons.ts` | Labels and icons per category. |
| `links.ts` | Internal links that keep `?trip=`. |
| `base-path.ts` | `BASE_PATH` for URLs the browser fetches directly. |
| `theme-color.ts` | `THEME_COLOR` (Sen: `light: "#f4f6fa"`, `dark: "#0d1220"`) and `applyThemeColor(theme, palette)`, which picks the page background for the family and mode and sets `<meta name="theme-color">` so the browser bar follows the choice. Tests in `theme-color.test.ts`. |
| `palette.ts` | Colour families: `PALETTES` (`sen`, `ink`, `pine`, `plum`), `getPalette`, `setPalette`, `applyPalette` and `usePalette` (a small Zustand store). Saved per device under localStorage key `palette`. Sen sets no attribute; the others set `data-palette` on `<html>`. Tests in `palette.test.ts`. |
| `css-color.ts` | `resolveCssColor(value)` follows a `var(--x)` token (up to five hops) to the colour the page shows now; `resolvePinColors(pins)` does it for every pin. Google Maps draws pins itself and cannot read CSS variables, so this runs at draw time. Tests in `css-color.test.ts`. |
| `order.ts` | Sort keys with fractional indexing. |
| `use-media-query.ts`, `use-online.ts` | Responsive and connectivity hooks. `prefersReducedMotion()` is the plain check (not a hook) for motion started from code, such as scrolling to today; it reads the phone's "reduce motion" setting. |

Weather and daylight:

| File | Role |
|---|---|
| `open-meteo.ts` | `placeQueries(name)` (the name, then its first word, e.g. "Tokyo (Ueno)" → "Tokyo"), `locateCity(name)` (geocoding, `countryCode=JP`), `forecast(at)` (16 days, daily weather code, max and min °C, rain chance, Tokyo time), `typical(at, dates)` (the same dates over the last three years, one request per year). Requests in flight are shared; failures are not cached. Results are cached in localStorage under `weather:*` (geocoding 30 days, forecast 3 hours, typical weather 7 days); a version reset clears them. |
| `use-weather.ts` | `useDaysWeather(entries)` → Map of date to `{sun, weather}`. Dates within 15 days of today (Tokyo) get the forecast, later dates the typical weather, past dates the sun only. Offline, the sun shows once the city's coordinates are cached. |

Version and update:

| File | Role |
|---|---|
| `app-reset.ts` | `APP_VERSION`, the storage reset (keeps `locale`, `theme`, `palette`, `device-name`, `sidebar-open`, `hide-amounts`, `display-currency`, `days-view`, `quick-expense-category`, `payment-method`), cache clearing, reload. |
| `version-check.ts` | Compares the running version with `version.json` and decides whether to reset. |

### 3.6 `src/messages`, `src/test`, `scripts`

- `src/messages/en.json` and `es.json`: every visible string. Both must have the same keys. Validated by `scripts/validate.ts`.
- `src/test/setup.ts`: Testing Library and jest-dom, mocks the activity repository, stubs `ResizeObserver`.
- `src/test/fixture-trip.json`: the made-up sample trip (two cities, sample hotels and places). Validated against `TripDataSchema`. Used only by tests.
- `scripts/`: see §21.

### 3.7 File counts (tracked files)

| Area | Files |
|---|---|
| All tracked files | 355 |
| `src/domain` (non-test modules) | 39 |
| `src/components` (top-level, not `ui`) | 76 |
| `src/lib` | 97 (including tests) |
| `src/components/ui` | 27 |
| Scripts | 21 |
| Docs (`docs/`) | 5 |
| Test files (`*.test.*`) | 72 |

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
- Job `build`: checkout with full history (needed for the version from tags), Node LTS, `npm ci`, `npm run test`, `npm run validate`, `npm run lint`, `npm run typecheck` (`next typegen && tsc --noEmit`; typegen first, because a fresh checkout has no generated route types), `npm run build`, upload `out/` as the Pages artifact. A failing step stops the deploy.
- Job `deploy`: `actions/deploy-pages@v4`.
- **Lint and the type check are in CI.** Before this, only the tests, validation and build ran there, so the ESLint rule that refuses typed text in JSX (§19) only ran locally.
- **Not in CI:** `npm run test:rules`. Run it by hand. `firestore.rules` is also **not** published by the deploy: paste it into the Firebase console (Firestore → Rules → Publish).

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
| `/itinerary-app/todos/` | `app/todos/page.tsx` | `?trip=`, optional `?list=<id>` | To-do lists (opens the named list) |
| `/itinerary-app/settings/` | `app/settings/page.tsx` | `?trip=`, optional `?tab=<section>` | Settings (opens the named tab, default Stays) |
| `/itinerary-app/404.html` | `app/not-found.tsx` | any | Not found; redirects old links |
| `/itinerary-app/manifest.webmanifest` | `app/manifest.ts` | — | Install metadata |
| `/itinerary-app/version.json` | `app/version.json/route.ts` | — | `{ "version": "x.y.z" }` |
| `/itinerary-app/sw.js` | generated by Workbox | — | Service worker |

**`?trip=`** is the trip ID. Every internal link keeps it (`pageHref()` in `src/lib/links.ts`), so a shared link keeps working after navigation. The trip ID is in the link only, never in the repo.

**`?share=<shareId>`** opens the read-only view of a share copy on any route (§12.8). The share ID is 128 random bits, base64url, and is not the trip ID. The tab keeps it in sessionStorage, so navigation inside the app works without it in the URL. A `?trip=` link leaves viewer mode. Internal links do not add `?share=`.

**Old links:** before the static-query design, pages were `/day/2026-12-18/` and `/city/nagoya/`. `old-link-redirect.tsx` on the 404 page forwards them to `/day/?date=…` and `/city/?id=…`.

**Navigation** is Next's `Link` (client-side) for internal links, and `window.location` for full reloads when the trip changes (`openTrip`, `openMyTrips`), so nothing from the previous trip stays in memory.

---

## 6. Component tree

### 6.1 Root layout, top to bottom

```
<html lang="en">                            src/app/layout.tsx (Server Component)
 <head>
  <script>LANG_BOOT_SCRIPT</script>        inline, before first paint: sets lang from the saved or browser language
 </head>
 <body>
  ThemeProvider                            next-themes; dark class on <html>
   VersionGate                             version check, storage reset, initLocale
    ServiceWorkerRegister                 registers sw.js (production)
    Suspense > PlanSync                   member listeners, or ViewerSync for ?share= (no DOM)
    LocaleRoot                            remounts the app on language change
     AppGate                              splash / sign-in / trip picker / member app / shared view
      AppSidebarProvider                  sidebar open state (localStorage)
       AppHeader (Suspense)               trip switcher, section links (md), sync status, search, activity, account
                                          (viewer: trip name, Read-only badge, search, ViewerSheet)
       OfflineBanner                      shown when offline
       <div flex>
         AppSidebar (Suspense)            wide screens only (lg and up)
         <div>{children}</div>            the page: main > screen component (error.tsx catches a crash here)
       BottomNav (Suspense)               phone tab bar (below md)
       VersionTag                         desktop corner text (md and up)
   Toaster (sonner)                       above the tab bar on phones
```

**Crash screens.** `error.tsx` is a boundary inside the root layout, around `{children}`. A crash in a page replaces only that page; the header, sidebar and tab bar stay. `global-error.tsx` sits above the layout. A crash in the layout itself (AppGate, header, sidebar) replaces the whole document, so it renders its own `<html>` and `<body>`, loads `globals.css` and applies the saved dark theme, because next-themes is not running there. Both use `ErrorScreen` (§3.3).

### 6.2 Screen components per page

| Page | Screen | Main children |
|---|---|---|
| `/` | `DashboardScreen` → `DashboardContent` | `TodayCard`, `Tile`, `Panel`, `ClockTiles` (`dashboard-parts.tsx`), `Charts`, `Yen`, `HideAmountsButton` |
| `/days/` | `TripName`, `TripDates`, `TripPlanStatus`, `ExportTrip`, `TodayCard`, `NeedsNewDay`, `ResearchNotice`, `TripDays` (`TripCalendar` or the list, by the `ToggleGroup`) | — |
| `/day/` | `DayScreen` → `DayPlan` | `SortableStop`, `StopCard` (`day-plan-stop.tsx`), `FullDay`, `HotelButtons`, `BookingsButton`, `Reservations` (`day-plan-links.tsx`), `FlightCard`, `DayResearchPanel`, `DaySidePanel` columns, `PlaceDetails`, `EditPanel`, `TripMap`, `CostLine`, `LegLine`, `CategoryBadge`, `PriorityBadge`, `WaitingTags` |
| `/city/` | `CityScreen` → `CityCatalog` | `TripMap`, `PlaceDetails`, `AddPlace`, `CostLine`, `ToggleGroup` filters, `Select` for priority |
| `/cities/` | `CitiesScreen` | — |
| `/budget/` | `BudgetScreen` → `BudgetContent` | `SummaryFigures`, `ExpenseRow`, `TargetRow`, `MemberTargetRow`, `BudgetForm`, `ExportExpensesButton` (`budget-parts.tsx`, `budget-figures.tsx`), `PersonPanel` (`budget-person.tsx`), `CashSection` (`cash-section.tsx`), `ExpenseForm`, `EditPanel`, `BudgetGauge`, `DonutChart`, `BarList`, `Yen`, `HideAmountsButton` |
| `/settings/` | `SettingsScreen` | one panel per tab (`Stays`, `Cities`, `Places`, `Flights`, `Reservations`, `Holidays`, `Trip`, `Share`, `Backup`, `Cleanup`); `EditPanel` in each; `ProposalReview` in Places; `NotOnSharedView` in viewer mode |
| `/todos/` | `TodosScreen` | `ListForm` and `TodoForm` (`todo-forms.tsx`) in `EditPanel`; a list Select on phones; hidden in viewer mode |

### 6.3 Shared overlays

| Overlay | Used by | Phone | Wide (768px and up) |
|---|---|---|---|
| `PlaceDetails` | day, city | Drawer (vaul) | Sheet (side) |
| `EditPanel` | place editor, expenses, settings forms | Drawer | Dialog |
| `AddToDay` | place details | Drawer | Dialog |
| `SearchPalette` | header | Command dialog | Command dialog (`Ctrl K` hint) |
| `ActivitySheet` | header | Sheet | Sheet |
| `AccountSheet` | header | Sheet | Sheet |
| `ViewerSheet` (viewer mode only, in place of Activity and Account) | header | Sheet (right) | Sheet (right) |
| `NewTripPanel` (uses `EditPanel`) | gate, trip switcher | Drawer | Dialog |

---

## 7. Startup sequence

What happens on first load, in order:

1. **Static HTML** is served. It contains the `Splash` (the icon) and nothing else about the trip. Nothing about the trip is in the HTML. Its `<html lang>` is `"en"`, but the inline `LANG_BOOT_SCRIPT` in `<head>` runs before the first paint and sets `lang` to the saved or browser language, so screen readers use the right voice from the start.
2. **`VersionGate`** (client) runs first:
   - `initLocale()` sets the language: the last choice from localStorage, otherwise the browser language (Spanish if it starts with `es`, else English).
   - In production only: removes `?v=` from the URL; if the stored version is different, resets the device (`resetApp`), which keeps `?share=` in the URL so a viewer returns to the shared view; otherwise fetches `version.json`, and shows the app once the check answers or after 2 seconds, whichever comes first.
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
| signed in, no trip chosen yet (trips still loading, or listed but none chosen yet) | Splash (or offline screen if offline) |
| several trips, none chosen | Trip picker |
| no trips | "No trips" screen (with "New trip" if allowed) |
| `access = denied` | "Not on this trip" |
| `access = missing` | "Trip not found" |
| `access = checking` | Splash (or offline screen) |
| `member`, a trip collection or the plan store not yet answered | Splash |
| `member`, loaded | The app |

7. **Listeners open only for `member`** (`PlanSync`): `usePlanSync(tripId)` subscribes to `items`, `useTripSync(tripId)` subscribes to the ten collections. Until then the rules would refuse them. In the same effect, `MemberSync` calls `watchStartupWrites()` and `requestPersistentStorage()` (§17.1) once the trip is live.
8. **Remembering**: once a member is confirmed, the trip ID is saved in localStorage and in `users/{uid}.lastTripId`.

**Viewer mode (`?share=`)** replaces steps 5, 7 and 8 for that tab:

- `viewerShareId()` reads `?share=` and starts viewer mode. `PlanSync` renders `ViewerSync` instead of `MemberSync`, so auth never starts (no `users/{uid}` read or write) and no member listener opens.
- `ViewerSync` (`useShareSync`) loads the copy once from the server through `getViewerDb()`, with no sign-in, and fills `useTripStore` and `usePlanStore`. It checks the expiry every minute and closes the view when the link expires. It re-reads the copy every 10 minutes, so a closed link stops within that time.
- `AppGate` shows, in order: Splash while loading; "This link isn't open" when the link is closed, expired or unknown (with a button to leave and sign in); the offline screen when offline; otherwise the app.
- Nothing about the copy is stored on the device. Only language and theme are kept, as for members.

---

## 8. Data flow: reads, writes and listeners

### 8.1 Reads

```
Firestore (trips/{id}/cities|stays|reservations|places|holidays|expenses|flights|cash|todoLists|todos)
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

Shared view (viewer mode, no sign-in):

```
Firestore (shares/{shareId}, then shares/{shareId}/{cities|stays|reservations|places|holidays|flights|items})
   └─ getViewerDb() ── loads the copy once, then re-reads it every 10 minutes
        └─ useShareSync ─ tripStore / planStore (same shape as members' data)
             └─ the same screens, with the read-only changes in §12.8
```

The copy has no expenses, budget or member emails (§12.8), so the viewer's stores never hold them.

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
- Counting: every write goes through `tracked-firestore.ts`, which calls `trackWrite` (`sync-store.ts`) on its promise. The write counts as pending from the moment it is made until that promise settles, so the header's `SyncStatus` shows "saving" while it is in flight and "waiting" when offline (§17.1). Writes queued before a reload are counted through `trackStartupWrites` instead.
- Batches: `saveMany` uses `writeBatch` in chunks of 450 (Firestore limit is 500 per batch). Each committed batch is counted the same way.
- Share links (members only, Settings → Share): create writes `shares/{shareId}` and its copy; **Refresh** (publish) rewrites the copy from the current trip; **Change expiry** updates `expiresAt`; **Close link** sets `revoked: true`, which cannot be undone. Each action writes one activity entry (kind `settings`). The trip itself is only read.

### 8.3 Deletes

Nothing is deleted in normal use:

| Thing | "Remove" means |
|---|---|
| Plan item | `status: "removed"` (restorable; shown in "Recently changed") |
| Trip record (city, stay, place, reservation, holiday, expense, flight, cash record) | `archived: true` |
| To-do list or to-do | `archived: true`. Archiving a list also archives its live to-dos (`archiveList`). |
| Proposal | `status: "dismissed"` |
| Day research | Cancel request sets `status: "archived"` (or goes back to the earlier analysis); Clean up deletes archived day research |
| Activity entry | kept; deleted only by Clean up or by the rules' delete rule for members |
| Share link | Close marks it `revoked` (kept). Clean up deletes a link only once it is closed or expired, with all its copy records |
| Copy record (refresh) | A refresh deletes copies of records that no longer exist in the trip. The trip is not touched |

Only **Settings → Clean up** deletes, through `CleanupRepository` (share links through `removeShare`). The rules allow deletes only for records already retired (§23).

### 8.4 Activity log

- Every change worth remembering writes one entry (`trips/{id}/activity`): time, device name, kind, target, short summary, and before/after JSON (up to 4,000 characters each).
- Kinds: `added`, `moved`, `reordered`, `edited`, `removed`, `restored`, `undone`, `queued`, `assigned`, `dismissed`, `settings`. Share actions (created, refreshed, closed a link) use `settings`.
- The sheet subscribes to the newest 50 only while open, so it costs no reads otherwise.
- Undo: `undoFor` in `domain/activity.ts` gives the reverse change while the stop has not changed since.

---

## 9. Mobile and desktop layouts

The app is designed for a 390px phone first, then widened (CLAUDE.md rule 8). Breakpoints are Tailwind's defaults plus two media queries in code.

### 9.1 Breakpoints

| Width | Name in this app | What changes |
|---|---|---|
| below 768px | **phone** | Bottom tab bar (`BottomNav`, six sections). Drawers (vaul) for place details, edit and add-to-day. Day page shows one column at a time: list, map or waiting. Tapping a waiting place adds it (phones can't drag). Version tag hidden (it is under Account → About). |
| 768px and up (`md`) | **tablet / small desktop** | Bottom tab bar hidden. Section links in the header. Dialogs and side sheets instead of drawers. Day page shows two columns: stops on the left, and Waiting and the map on the right. Version tag in the corner. |
| 1024px and up (`lg`) | **desktop** | Header section links hidden (sidebar takes over). Left sidebar with all sections and every trip day. Sidebar can collapse to icons (state kept in localStorage). |
| 1280px and up | **wide** | City catalogue shows list and map side by side (`city-catalog.tsx`). |

### 9.2 How the code decides

- `useMediaQuery("(min-width: 768px)")` (`src/lib/use-media-query.ts`) is used in `day-plan.tsx`, `add-to-day.tsx`, `edit-panel.tsx`, `place-details.tsx`. On the server and the first client render it returns `false` (phone layout), then updates after mount. This keeps the static HTML matching the first render.
- `useMediaQuery("(min-width: 1280px)")` in `city-catalog.tsx` for the side-by-side layout.
- The shadcn sidebar (`ui/sidebar.tsx`) uses `(max-width: 1023px)` to switch to an off-canvas sheet. The app has no trigger for that sheet, so below 1024px the sidebar is never shown; the day list is reached through the Days page.
- Layout classes are Tailwind responsive prefixes (`md:`, `lg:`), used in about 30 component and page files. Page wrappers grow from `max-w-md` (phone) to `max-w-[100rem]` (desktop).
- One-column grids must use `grid-cols-1`. An implicit grid track grows to its widest content and overflows the phone screen.
- Buttons are larger on touch screens: the `pointer-coarse:` variants in `src/components/ui/button.tsx` set the default size to 44px tall, `sm` to 40px and `lg` to 48px. The icon sizes are 44px (`icon`), 40px (`icon-sm`) and 48px (`icon-lg`). `xs` and `icon-xs` stay 32px.
- Bottom padding: the body adds `pb-[calc(4rem+env(safe-area-inset-bottom))]` below `md`, so the tab bar does not cover content.
- `viewportFit: "cover"` and safe-area insets are used so notched phones are handled.

### 9.3 Interaction differences

| Action | Phone | Desktop |
|---|---|---|
| Move a stop | Move up or down with the buttons, or pick another day | Drag with pointer; keyboard drags too (dnd-kit sensors) |
| Add a waiting place | Tap it | Drag it to a day or stop, or tap |
| Search | Header search button | Header button or Ctrl K / ⌘K |
| Sections | Bottom tab bar | Sidebar (or header links between 768 and 1023px) |
| Details | Drawer from bottom | Side sheet |
| Toasts | Above the tab bar | Bottom right |

Reduced motion applies to both layouts. When the phone's "reduce motion" setting is on, `globals.css` cuts every animation and transition to 0.01 ms, runs each animation once and turns off smooth scrolling. Drawers, sheets, dialogs, toasts, pulses and the dnd-kit reorder then change at once instead of sliding. The duration is 0.01 ms rather than `none` so `animationend` and `transitionend` still fire, which vaul and Radix wait for before unmounting. Motion started from code checks `prefersReducedMotion()` (`src/lib/use-media-query.ts`): "scroll to today" in `trip-days.tsx` jumps instead of scrolling smoothly. Tests in `use-media-query.test.ts`.

---

## 10. Theme

- **Library:** `next-themes`, in `src/components/theme-provider.tsx`. Attribute `class`, themes `light` and `dark`, default `light`, `enableSystem={false}`, `disableTransitionOnChange`. It sets `class="dark"` on `<html>` before the first paint, so `suppressHydrationWarning` is on `<html>`.
- **Colour families:** four families, Sen (default), Ink, Pine and Plum, each with a light and a dark mode. Light and Dark are the mode (next-themes). The family is a separate choice, made in the Account sheet and the viewer sheet with `palette-picker.tsx`. The Ink, Pine and Plum colours come from `docs/theme-options.html`; in the app they are named Ink (Kumo light, Sumi dark), Pine (Matsu light, Mori dark) and Plum (Ume light, Yoi dark). Switching families needs no code change or deploy.
- **Palette storage:** `src/lib/palette.ts` (`PALETTES`, `getPalette`, `setPalette`, `applyPalette`, `usePalette`) saves the family per device in localStorage under `palette`. Sen sets no attribute. The others set `data-palette` on `<html>`. In `globals.css` each has a `:root[data-palette="ink|pine|plum"]` block and a `:root[data-palette=…].dark` block, and every token Sen defines is in each. The `.dark` block has the higher specificity, so it wins over the light block and the plain `.dark` rule. `palette` is in the kept-keys list, so it survives a version reset like `theme`.
- **Choices:** Light and Dark only, with no "Match phone" option. The button in the Account sheet switches between them (`theme-toggle.tsx`). On a device with no stored choice, or with the old stored `system` value, `PickFirstTheme` picks light or dark once from `prefers-color-scheme` and saves it. The choice is stored by next-themes under `theme` in localStorage. It is in the kept-keys list, so it survives a version reset.
- **Tokens:** colours are CSS variables on `:root` and `.dark` in `src/app/globals.css`, as hex values: light has a cool paper-white background (`#f4f6fa`) and indigo `--primary` (`#2b47a8`); dark has a deep indigo background (`#0d1220`) and `--primary` `#96aaff`. Other tokens: `--background`, `--foreground`, `--muted`, `--border`, `--sidebar-*`, `--chart-1..5` (an indigo scale, not used by any component), and others. `--now` with `--now-foreground` is kept for the present moment (today, the next stop). `--success` and `--warning` are for status. All of these exist in both themes. The Dashboard's charts take their colours from these tokens too: spend per day and "planned" stops use `--primary`, "done" stops `--success`, "skipped" stops `--muted-foreground`. Tailwind maps them to utility names (`bg-background`, `text-muted-foreground`, `bg-now`, `text-now-foreground`, `text-success`, `text-warning`). `h1` and `h2` use the heading font through a base rule.
- **Status colours and page titles:** status colours always come from the tokens: `--warning` for warning states (planned expenses, due-soon to-dos, the cash warning, the early sunset, the medium day load and the day research warnings), `--success` for good states (the light day load, "Accepted" places, done to-dos) and `--destructive` for the heavy day load and late to-dos. No component uses fixed amber, emerald, red or hex colour classes. Every screen's `h1` is `text-3xl font-bold` in the heading font.
- **Selected and highlighted controls:** selected toggles (`ui/toggle.tsx` with `aria-pressed`, and `ui/toggle-group.tsx` items with `data-state=on`) use a soft tint of `--primary`, not `bg-muted`. `--accent` (light and dark) is a soft indigo tint (`#e2e8fb` light, `#232e58` dark), so hovered and highlighted menu items show colour.
- **Corners and cards:** `src/app/globals.css` redefines the radius scale in `@theme inline`, so `rounded-4xl` is 14px (sm 4px, md 6px, lg 8px, xl 10px, 2xl 11px, 3xl 12px, 4xl 14px, from `--radius` 0.625rem). Cards are flat: no shadow, a 1px ring in `--border`, 20px padding (16px for `size="sm"`). Badges use `rounded-md`, not pills.
- **Dark variant:** `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css`, so `dark:` classes follow the `dark` class.
- **Base colour:** `stone` in `components.json`.
- **Category, priority, spending and pin colours** (`src/app/globals.css`, `src/domain/taxonomy.ts`, `src/domain/map-pins.ts`): each of the eight palette × mode blocks (Sen, Ink, Pine and Plum, each light and dark) defines the same token names:
  - `--cat-lights`, `--cat-food`, `--cat-shopping`, `--cat-sight`, `--cat-daytrip`, `--cat-temple` for the categories;
  - `--prio-must`, `--prio-want`, `--prio-maybe` for the priorities;
  - `--exp-*` for the spending categories. `food`, `souvenirs`, `attractions`, `clothes` and `temples` alias the `--cat-*` tokens; `flight`, `booking`, `transport` and `other` have their own;
  - `--pin-stop`, `--pin-finished`, `--pin-hotel` for map pins.

  Each hue is the same in every family, so a category keeps its meaning; lightness and chroma are tuned per family and mode. The colours were checked with the dataviz validator: at least 3:1 against `--card`. Where two colours sit close, the icon and label carry the meaning, not the colour alone.
- **Taxonomy as tokens:** `CATEGORY_COLOR`, `PRIORITY_COLOR` and `EXPENSE_COLOR` in `taxonomy.ts` are `var(--…)` strings, so badges, filters, charts and pins follow the active theme without code changes. `DARK_STEP` and `darkStep()` are gone. `tint(color, percent)` mixes a colour into `var(--card)` with `color-mix`. `map-pins.ts` uses `var(--pin-…)` for the stop, finished and hotel pins. Category and priority badges show these colours only on their icon, not as a fill (`tag-badges.tsx`). `palette-tokens.test.ts` checks that every block defines each token the taxonomy and pins use.
- **Charts:** `configFor()` in `charts.tsx` gives each series one colour, used in light and dark. The Dashboard's fallback colour is `var(--muted-foreground)`. City colours are the owner's data (`color` on the city) and are used as stored. `--chart-1..5` is still unused.
- **Google Maps pins:** Google draws pins itself and cannot read CSS variables, so `src/lib/css-color.ts` turns each `var(--x)` into the real colour the page shows (`resolveCssColor`, `resolvePinColors`). `TripMap` redraws when pins, lines, the colour family or light/dark mode change.
- **Theme options page:** `docs/theme-options.html` shows each theme's category and priority colours (swatches, and one matrix row per token), with the other tokens.
- **Map:** `trip-map.tsx` reads `resolvedTheme` and passes `colorScheme: "light" | "dark"` to the Maps service, so the map follows the app.
- **Toasts:** `sonner` reads the theme through `useTheme`.
- **Browser chrome:** `THEME_COLOR` (`src/lib/theme-color.ts`) is the source. The root layout's `themeColor` and the manifest's `theme_color` and `background_color` use `THEME_COLOR.light` (Sen). `ThemeColor` in `theme-provider.tsx` calls `applyThemeColor(theme, palette)` whenever the resolved theme or the palette changes, so the browser bar follows the chosen theme and family.
- **Cities** have their own colour (`#rrggbb` in `cities` documents), used for dots in the sidebar and day list. On the Day page a city's colour is the line of its days: the header has a short band in that colour, and the stop rail uses the colour of the day's first city. `--now` marks the next stop.
- **Font:** IBM Plex Sans (`--font-sans`, text), Barlow Semi Condensed (`--font-display`, mapped to `--font-heading`, used by the `font-heading` class for headings, dates, times and amounts) and Geist Mono (`--font-mono`) via `next/font`.
- **Shell:** the open section in the phone tab bar (`BottomNav`, on the card colour, tabs at least 56px tall) and the open section's header link on tablets are marked with the soft `--accent` tint and `text-primary`; on phones the icon also sits in a soft pill (`bg-accent`), and the label is semibold. The sidebar's active item uses the soft sidebar tint (`bg-sidebar-accent`, `text-sidebar-primary`, semibold) in both themes, not a solid fill. `--now` (`bg-now text-now-foreground`) marks today in the sidebar, as the "Today" chip beside today's day. It also marks today in the calendar (the cell's border and a soft ring, date number in `text-now`), in the day list (today's row and its "Today" label), and on the Dashboard's Today card during the trip (ring, and the next stop's name in the heading font).

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
| Days | Checkbox items, one per day the city covers, with its stop count; "All places" clears | With days chosen, list and map show only places with a non-removed stop on those days (category and priority still apply). Pins are coloured per day (`DAY_COLORS`) and numbered in that day's order, with a legend of the days over the map. A place on two chosen days shows once, with the earlier day. |
| Category | All, plus each category | Toggle group |
| Priority | All, must, want, maybe | Select |
| Unassigned only | yes/no | "Unassigned" = not used by any active plan item. Disabled while days are chosen. |

The filter selects show an icon for every option, as on Budget (§12.5).

Nearby places: `nearbyByPlace` finds other places within 1 km using saved coordinates (`NEARBY_KM`).

"Show on map" in place details (§3.3) closes the details, switches phones to the Map view, clears the filters if they hide the place, and focuses its pin.

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

Tiles built from `domain/dashboard.ts`: days until the trip or days left (`tripClock`), trip length, stops today and left today, stops per day, quiet days, places by category and priority, must-see places not yet planned, stops on closed days, upcoming holidays, nights without a hotel, next reservation, stay tonight, next flight (`nextFlight`), route legs for today, budget summary (`Yen`, which can be hidden, see §12.5), and places to research. Charts from `charts-lazy.tsx` (recharts via shadcn chart, loaded on first use). The Watch out panel lists open to-dos that are late or due within 7 days first (up to 4, then "N more"), each linking to `/todos/?list=<id>` (§12.9).

**Shared view:** the budget tile, the Money section and cost per city are removed. The "Watch out" list has no research or Settings links.

### 12.2 Days (`/days/`)

Trip name and dates, plan status, export of the trip (`ExportTrip`), today card, "needs a new day" (stops whose day is no longer valid after a stay moved), research notice (proposals to review), and the days in one of two views, chosen with a Calendar / List `ToggleGroup` next to the "Today" button. **Calendar** is the default (`TripCalendar`, `trip-calendar.tsx`): Monday-first weeks in one grid, each trip day linking to `/day/?date=` with its stop count, flight, holiday and today ring; each hotel night is a city-coloured bar. Phones get compact cells; from `lg` cells also show city names, holiday names and "N stops". **List** is the day list grouped by hotel (`trip-days.tsx`, city dots, date, stop count, flight cards leaving or landing that day). Flights leaving on a date no stay covers (such as the way there and back) appear as cards before the first or after the last group of days, in both views. The choice is saved on the device in localStorage under `days-view`, kept through a version reset. Each calendar day has id `day-YYYY-MM-DD`, so "Today" scrolls to it. Research icons (search for a requested day, sparkles for a ready analysis) show on calendar cells.

**Shared view:** Export trip is hidden.

### 12.3 Day (`/day/?date=`)

`day-plan.tsx` shows, for one date (the stop rows and links are in `day-plan-stop.tsx` and `day-plan-links.tsx`, and the drag and stop actions in `use-day-plan-actions.ts`; see §3.3 and §3.5):

- **Flights** leaving or landing that day appear as cards at the top, with the times as on the ticket.
- **Stops** on a line: each stop is a row on the day's line, with its number on a rail down the left of the list (`LINE_ITEM` in `day-plan-stop.tsx`). The rail is drawn in `--day-line`, which `day-plan.tsx` sets to the colour of the day's first city (`--primary` if none). The row shows the place name, its badges and cost. The name is a button with an info icon that opens `PlaceDetails`, the same as tapping its map pin.
  - **Closed** (the default): the row shows only the line, so the day stays short. A chevron button (`aria-expanded`, labelled "Show the actions for {name}") opens it.
  - **Opened:** the stop shows **Went** and **Skip** buttons, which set `status` to `done` or `skipped` through `updateItem` (tapping the active one sets it back to `planned`), the map link, move up and down (phones), move to another day, log a cost and remove. The chevron then reads "Hide the actions for {name}". Went and Skip use the default button size (44px on touch screens).
  - **Next stop:** the first planned stop (`nextStop`) starts opened and carries a **Next stop** badge in the `--now` colour. Every other stop starts closed. Opening or closing a stop by hand wins over this default. When a stop is marked Went or Skip, the following planned stop becomes the next one and opens. A stop marked **Done** shows a badge in `--success`.
  - **Read-only link:** there is no chevron. The stop always shows its map link and nothing else.
- **Legs** between stops (`dayLegs`): the hotel to the first stop, stop to stop, and the last stop back to the hotel. Each leg is keyed by the stop it arrives at (or `end`). Walking routes are used for legs up to 1.5 km (`WALK_LEG_MAX_KM`), fetched from the Maps SDK and kept in memory; straight-line distance is the fallback (`use-walking-legs.ts`). The legs from and back to the hotel are labelled "From {hotel}" and "Back to {hotel}" (`LegLine`'s `label`). Legs sit on the rail between two stops (`LegLine`), and the list has no gaps between items, so the rail is continuous. This is the same on the phone list and the desktop stops column (`DroppableList`, `SortableStop`). Drag and drop is unchanged.
- **Warnings:** `stopWarnings` flags a place on one of its closed dates; `holidayWarnings` flags a holiday or closure on that date for the place's category. These are the only warnings on a stop.
- **Hotels** for the day (`hotelsForDay`): check-in and check-out. A hotel with saved coordinates gets the same walk time or distance as other legs, and, when **Show hotel** is on (see Map below), an "H" pin on the map, drawn larger than the stops (`emphasised`). A hotel with only a text location gets a directions link and no pin, walk time or distance; a note at the top of the day links to Settings > Stays (`hotelsOffMap` in `day-plan.tsx`).
- **Waiting list**: places in the trip not yet on a day (`waitingPlaces`), listed through `applyWaitingView`.
  - **Sort and filter** menu: sort by priority (the default), name A to Z or Z to A; filter by priority and category. **Clear** appears when anything differs from the default and resets sorting and filters.
  - **Show on map** is off by default and resets when moving to another day, because `DayScreen` keys `DayPlan` by date. When on, the listed places get pins beside the numbered stops, coloured by category through `cityPins`, and they follow the filters. Clear does not turn the pins off. Tapping a pin opens the place's details. Places with no coordinates are counted in a note under the map.
  - On phones the map is its own tab, so turning it on switches to that tab, where the same controls appear to turn it off. Neither the view nor the button is saved.
- **Layout:** on wide screens (md and up) the day has two columns: the stops on the left at full height; on the right, a row holding the Waiting column and a compact "Move to another day" column, with the map below it filling the rest. Phones keep the List, Map and Waiting tabs. Stop cards do not show Google photos; photos appear only in the place panel (§14.2).
- **Day research** (`DayResearchPanel`, under the flights): "Research this day" with an optional message ("Anything specific to look into?"). Sending saves the day as `requested` and asks for research on every place on the day; places with an open proposal are skipped, and already researched places are not asked again. While requested: the date, the message, Change request, Cancel request (goes back to the earlier analysis if there was one, otherwise archives; Undo in the toast). When ready: a "Day analysis" card that starts collapsed, so the day's stops stay near the top on a phone. The header has the title (a button that opens and closes it, a bigger target than the chevron), the load badge (green, amber or red), a warnings count, "Research again" and a chevron. Collapsed, it shows the load reason (two lines), "N place updates to review" when research is waiting to be accepted, and a "Show the full analysis" link. Opened, it shows the reason, summary, warnings (buttons open the named places), nearby ideas (a trip place opens its details, others a Google Maps search link), the answer, sources and date. Both the title and the chevron carry `aria-expanded` and `aria-controls`. If the day's places have ready proposals, "N place updates to review" (Review opens Settings > Places) and "Accept all for this day" (confirm, `applyProposals`, Undo). "Research again" asks again and keeps the last analysis until a new one replaces it.
- **Map** (`TripMap`): pins for the day's stops, lines between them. The map toolbar has **Show hotel** (`MapHotelsControl`, `map-hotels.tsx`), off by default. When on, the hotels get their pins and lines. On a moving day with two different hotels (morning and night), a multi-select chooses which hotel to show. Hidden hotels also hide the map lines to and from them; the list's walking legs are unchanged. The map opens full screen (Expand / Shrink, §3.3). "Show all pins" frames them again. **Show on map** in place details is offered when the place has a pin on this map (a stop, or a Waiting place shown on the map); phones switch to the map tab.
- **Drag and drop**: stops within a day, between days, from the waiting list (`drop.ts`). Keyboard support.
- **Bookings button**: lists reservations on the day (wide layout).
- **Costs**: `costTotal` for the day.
- **Weather and daylight** (`DayWeatherStrip`): in the header under the cost line, for the day's first city. Weather icon and name, high and low, chance of rain or snow, sunrise and sunset (sunset in `--warning` when before 17:00). A "Forecast" tag for dates within 15 days, a dashed "Typical" tag (a tooltip explains: the same dates over the last three years) for later dates, and the sun only for past dates.
- **Quick cost**: the "+ ¥" button in the button row logs an expense for that day's date (§12.5).

**Shared view:** the day research panel is hidden. No drag and drop, Went and Skip, up and down buttons, move to another day, log cost, remove, or add from the waiting list. Tapping a waiting place opens its details (it does not add it). The other-days column becomes links to those days. The List, Map and Waiting views, the filters and directions stay. Costs are hidden (`Yen` and `CostLine` render nothing).

### 12.4 Cities (`/cities/`) and City (`/city/?id=`)

- Cities list: each city in trip order with dates and how much is planned. Each city card is a plain card with a band across the top in the city's colour.
- City page: the catalogue (§11.2) for one city, with place details, add place, cost lines, the Days filter and the map.

**Shared view:** the city page has no edit name, Add place or archive. The filters and the map stay.

### 12.5 Budget (`/budget/`)

`budget-screen.tsx` and `domain/budget.ts` (the figures and the rows are in `budget-figures.tsx` and `budget-parts.tsx`, §3.3):

- **Expenses** (`expenses` collection): title, amount in whole yen (`amountJPY`, the figure every total counts), category, date, status (`planned` or `paid`), who paid, how it was paid (`paymentMethod`: `card` or `cash`), and optional links to a place, reservation or stay. `cityId` is the city the money was spent in; `stayId` keeps its meaning (the hotel's own bill).
- **Payer:** every expense has a member as payer. The "Not assigned" option is gone. An older expense with no payer counts under the trip's first member (`payerOf`). The Dashboard's "Paid by each person" bars use the same rule.
- **Payment method:** every way of logging an expense asks card or cash: the expense form, the quick cost entry, Log cost from a stop, stay or flight, and a booking's cost in Settings. The last choice is remembered on the device (`payment-method.ts`). Records saved before the field read as `card`.
- **Filters and sort:** the expense list can be filtered by status, person, payment (card or cash) and category, and sorted by newest, oldest, highest amount or lowest amount (`filterExpenses`). Filter selects show an icon for every option, and planned expenses show a `--warning` badge.
- **Against each person:** replaces the old "Paid by each person" card. One row per member shows what they paid against their own target (`byMember` on the budget), with planned spending below. Tapping a row opens `PersonPanel`: paid, planned, by card, in cash, their cash on hand, paid by category, and their expenses (editable), plus a button to filter the list to that person.
- **Cash** (`cash` collection, §23.21): the Cash card records withdrawals and handovers. Each member's cash on hand is withdrawn + received − handed over − paid in cash. The card shows the total withdrawn, the dollars the bank charged (typed by hand, never worked out from a rate), how many withdrawals still lack dollars, and who owes whom. Handovers net out per pair, so paying a person back is a handover the other way. Cash records never count in the budget totals.
- **Quick cost** (`quick-expense.tsx`, on the Today card during the trip and on each day page): a big amount field (with the ¥/$ toggle, `AmountInput`) and a category tile grid (`quick-expense-category` remembers the last tile). The panel shows the day and city it will use. The city is that night's hotel. "More details" opens the full expense form with the same values. Save writes an activity entry; the toast's Undo archives the expense.
- **Flights**: a flight's cost is not added to the budget by itself. The log cost button on its card opens the expense form filled in, with the amount in yen at the fixed `YEN_PER_USD` rate (USD costs only; yen costs are used as they are).
- **Estimates**: each place with a cost estimate counts for its category, unless an expense already covers that place, booking or stay (`estimateStops`).
- **Totals** by category (`totalsByCategory`) and by payer (`totalsByPayer`), and per-day spending (`spendByDay`).
- **Budget** on the trip document: total (yen), by category, number of travellers (the per-adult estimate is multiplied by travellers; `null` = number of members), and `byMember`, a spending target per member email (what that person may pay, whatever it was for). All are set in the Set budget form.
- **Figures**: spent, planned, budget left, days remaining (`daysRemaining`). Each has an uppercase label, and the figure is in the heading font (`budget-figures.tsx`). Expense amounts on each row are in the heading font too (`budget-parts.tsx`). Totals stay in yen. Dollars are shown at today's rate from `usd-rate.ts` (the fixed `YEN_PER_USD` when offline).
- **Charts**: donut by category, bars by day, gauge of budget used.
- **Hide amounts**: the eye button (`HideAmountsButton`) hides every amount on the Budget and Dashboard screens. Hidden amounts read as `HIDDEN_AMOUNT` (`¥****`), including chart legends and tooltips, and the dollar hint is gone. Charts still draw from the real numbers. Setting the budget and editing an expense are disabled while hidden. The choice is saved on the device (`hide-amounts.ts`).
- **Display currency**: the dollar button beside the eye (`CurrencyButton`) shows amounts in dollars, with a yen hint, on Budget and Dashboard. The choice is saved on the device (`display-currency.ts`). It is display only: totals, the budget and storage stay in yen, and hidden amounts still win.
- **Export CSV**: `ExportExpensesButton` in the header, shown when the trip has expenses. Downloads `expenses-<Tokyo date>.csv` built in the browser (Blob and a temporary download link; nothing is sent anywhere) via `expensesCsv` (`domain/expenses-csv.ts`). It always holds the real amounts, even while amounts are hidden. Meant for a spreadsheet or matching card statements after the trip.
- **Entering dollars**: `AmountInput` (expense form, quick cost, reservation form) has a ¥/$ toggle. In dollars the rate starts at today's rate and can be edited, and the yen result is shown. `readAmount` (`domain/amount.ts`) turns the entry into `amountJPY`, `originalUSD` and `rateJPYPerUSD`; both dollar fields are null for amounts typed in yen. Reopening an expense shows what was typed (`entryFor`).
- **Booking costs**: a reservation can have a cost (yen or USD) and a Paid or Planned status (§12.6). Saving it creates or updates one expense linked by `reservationId`, the first live one, with the card or cash choice made for it. Clearing the cost archives that expense. Budget rows show a "Reservation" or "Hotel" badge for linked expenses.

**Shared view:** `/budget/` shows `NotOnSharedView`. `Yen`, `CostLine` and `HideAmountsButton` render nothing anywhere in the app, so no amounts appear in place details or on the days.

### 12.6 Settings (`/settings/`)

Tabs (`settings-screen.tsx`):

| Tab | Edits |
|---|---|
| Stays | hotels (name, maps link, check-in/out, city, note). The form offers Google's suggestions under the hotel name; choosing one saves the place ID and coordinates (`locationSource` `google`, so `maps:refresh` renews them). Renaming a hotel or changing its link clears the old place ID and coordinates. A stay with no coordinates shows a "Not on the map yet" badge. A hotel still to be decided (`isUndecidedHotel` in `domain/trip.ts`) is never looked up. |
| Cities | cities (name, colour) |
| Places | places: edit fields, filters, research requests, proposal review (`ProposalReview`), add draft |
| Flights | flights: airline, flight number, departure and arrival airport, city, date and time, confirmation (optional), cost (USD or yen), note. Archive and restore. Each flight shows on the days it leaves and lands. |
| Bookings | reservations (train, hotel, tour, ticket). New bookings can no longer be of type flight; an older flight booking can still be edited. Optional cost in yen or USD, with Paid or Planned; it is saved as one linked expense (§12.5). Reservation cards show that cost. |
| Holidays | holidays and closures |
| Trip | trip name, members (email list, max 20), budget (total, by category, travellers, and per-member targets) |
| Share | read-only share links: name, expiry, copy link, refresh, change expiry, close (§12.8). Members only. |
| Backup | export the whole trip as JSON, including flights, cash records and day research; import only into a trip that has nothing saved. Older backups without flights still import. |
| Clean up | the retired records (archived, including archived cash records, removed, dismissed, archived day research, archived to-dos and to-do lists no live to-do uses, legacy queue, activity) and delete them for good; counts shown first. A "Closed share links" row deletes expired or closed share links with their copies. |

Account sheet (header): signed-in email, theme toggle, language choice (saved to the profile), About (version, "start fresh" which runs `resetApp`), and sign-out.

**Offline copy (Settings → About, `settings-about.tsx`):** the About section shows "Offline copy: kept on this device." when the browser has agreed to keep the offline copy (§17.1), or "Offline copy: the browser may clear it…" with an "Ask to keep it" link button. The button calls `requestPersistentStorage()`; if the browser still refuses, a toast suggests adding the app to the home screen. The line is hidden when the browser has no storage API. Texts are the `about.storage*` keys.

**Shared view:** `/settings/` shows `NotOnSharedView`. The Account sheet is replaced by the viewer sheet (§12.8).

### 12.7 Trip switcher and trip creation

- Header trip name opens a menu when there are other trips, or when the person may create one. `New trip` makes a trip with the person as the only member (`createTrip`).
- Only emails in `config/access.tripCreators` can create trips (rules and `canCreateTrips`).

### 12.8 Read-only share links

Members can give anyone with the link a read-only view of the trip, with no sign-in. Share links are made in **Settings → Share** (`settings-share.tsx`; rules in §15.2, data in §23.1).

**For members:**

- Each link has a **name** (seen only by members) and an **expiry**: 1, 3, 7, 14 or 30 days, or a date and time in Japan time. The expiry can be at most 30 days ahead (`MAX_SHARE_DAYS`).
- The link looks like `https://domokratos11.github.io/itinerary-app/?share=<shareId>`. The share ID is 128 random bits (`newShareId`, `parseShareId` in `src/domain/share.ts`). The trip ID is not in the link.
- Actions per link: **Copy link**; **Refresh** (rebuilds the copy from the trip now); **Change expiry**; **Close link** (permanent). Create, refresh and close are written to the activity log.
- The copy changes only when a member presses **Refresh**. Edits to the trip do not reach it until then.

**What the copy holds** (`toSharedTrip` in `src/domain/share.ts`):

- Cities, stays, reservations, places, holidays, flights and plan items, in the same record shapes as the trip. Archived records and removed stops are left out.
- Not included: expenses, the budget, cash records, to-dos, member emails and day research. `sharedTripData` gives the viewer an empty cash list and no to-dos.
- Blanked: a place's cost estimate (null); a flight's confirmation number (null), cost (null, currency JPY) and note (null); the notes on stays and reservations (null).
- Google coordinates older than 30 days are dropped (§14).

**For viewers** (no sign-in, `?share=` in the link):

- The app shows Dashboard, Days and Cities only. `/budget/` and `/settings/` show `NotOnSharedView`. Each screen's changes are listed in §12.1 to §12.6.
- The header shows the trip name, a "Read-only" badge, search and the viewer sheet (language, theme, and "Leave shared view", stored only on the device) in place of Activity and Account.
- The copy loads once, and the app checks the expiry every minute. It re-reads the copy every 10 minutes, so a closed or expired link stops within that time. A closed, expired or unknown link shows "This link isn't open", with a button to leave and sign in.
- Place details still fetch photos and hours from Google, under the same per-device daily limit as members (§14.2).
- Auth never starts in viewer mode, and `getDb()` throws, so nothing can read or write the real trip from a link.

---

### 12.9 To-dos (`/todos/`)

`todos-screen.tsx` and `todo-forms.tsx`, on the pure logic in `domain/todos.ts` (§13). The route `/todos/` takes an optional `?list=<id>` that opens that list.

- **Section:** "To-dos" (ListChecks icon) sits between Budget and Settings in `SECTIONS`. It is hidden on read-only links, as Budget and Settings are. The phone tab bar has six columns.
- **Lists:** each list has a title, an optional description, a colour dot and a sort order. On wide screens (lg) the lists sit in a left column, each with its colour dot, a progress bar and the open count, plus "All lists". On phones the list is picked from a Select.
- **To-dos:** each row has a checkbox to mark it done, a due badge (late in `--destructive`, due within a week in `--warning`), a priority, the assignee (a member) and a menu for status, edit and archive. Status changes go through `withStatus`, which keeps `completedAt`.
- **Filter and sort:** filter by all, open or done; sort by manual order, due date or priority (`visibleTodos`). In manual order, up and down buttons move a to-do (`swapOrder`); new to-dos get the next key (`nextOrder`).
- **Archive:** archiving a to-do sets `archived`. Archiving a list also archives its live to-dos (`archiveList`). Nothing is deleted in normal use; Clean up deletes archived to-dos and archived lists that no live to-do uses (§12.6).
- **Dashboard:** the Watch out panel lists late or soon-due open to-dos first (§12.1).
- **Shared view:** the section is hidden, and viewers get no to-dos (§12.8).
- **Data:** lists and to-dos are trip collections (§23.22). They sync through `TripRepository` into `useTripStore`, go into backups and are written with `saveRecord`.

---

## 13. Domain logic

Pure functions in `src/domain/`. Names are the exports most often used.

| Module | Key functions | Rule it encodes |
|---|---|---|
| `days.ts` | `deriveDays(stays)`, `weekdayOf`, `tripPhase`, `toUtcDate`, `addDays` | A day belongs to every stay whose range includes it, both ends included, so transfer days belong to two cities. |
| `calendar.ts` | `calendarWeeks(days)`, `stayBands(week, stays)` | `calendarWeeks` gives whole Monday–Sunday weeks around the trip, cells `{date, day, showMonth, monthIndex}`. `stayBands` gives runs of columns per hotel night for the coloured bars. |
| `trip.ts` | `activeTrip`, `stayId`, `nightStay` | Archived hidden; stays sorted by check-in; stay ID = `cityId-checkIn`. `nightStay(date, stays)` is the hotel slept in that night: on a transfer day, the hotel you arrive at; on the last day, the hotel you leave. `groupDaysByStay` uses it too. |
| `plan.ts` | `itemsForDay`, `nextStop`, `keysForInsert`, `holidayWarnings`, `stopWarnings`, `costTotal`, `newPlanItem`, `distanceBetweenPlaces`, `placeLocation`, `stayLocation`, `directionsUrl` | Order is a fractional key. Stops have no time of their own. |
| `legs.ts` | `dayLegs`, `formatWalk`, `formatStation` | Walk if ≤ 1.5 km, else transit or taxi. |
| `order.ts` (lib) | `keyAt`, `keysBetween` via fractional-indexing | Moving a stop rewrites one key. |
| `drop.ts` | `planDrop` | Which target a drop lands on (stop, day, list), and which keys change. |
| `location.ts` | `coordinatesExpired`, `dueForRefresh`, `withoutGoogleCoordinates`, `doubtfulMatch`, `medianPoint` | Google coordinates expire after 30 days and are due for refresh from day 20. `doubtfulMatch` flags a match more than 2 km from coordinates already saved, or far from the city centre (30 km; 200 km for day trips). Flagged matches are reported for a person to confirm. |
| `live-hours.ts` | `parseGoogleHours`, `openNowFrom`, `hoursDifference` | Reads Google's English opening-hours text into periods, and works out whether a place is open now. |
| `map-pins.ts` | `placePoint`, `cityPins`, `dayMap`, `straightLines`, `stopColor`, `dayFilterPins` | Pins per stop, straight lines when no route. `dayFilterPins` gives the City page's pins and day legend for the chosen days (a place on two days shows once, with the earlier day). |
| `budget.ts` | `summarizeBudget`, `totalsByCategory`, `totalsByPayer`, `estimateStops`, `spendByDay`, `daysRemaining` | Expenses beat estimates for the same place; yen integers. |
| `dashboard.ts` | many tile functions (see §12.1) | All figures from in-memory data. |
| `todos.ts` | `dueState`, `todosDueSoon`, `listProgress`, `visibleTodos`, `nextOrder`, `swapOrder`, `withStatus`, `archiveList` | Due states in Japan time: overdue, soon (within 7 days), later, none. `archiveList` also archives the list's live to-dos. Nothing is deleted. |
| `proposals.ts` | `newProposal`, `isOpenProposal`, `acceptProposal`, `changedFields`, `researchToAccept`, `cleanResearch`, `ResearchResultSchema` | Research never writes a place. Accepting copies chosen fields and their sources; status becomes `researched`. |
| `place-edit.ts` | `applyPlaceEdit`, `validatePlaceForm`, `missingFields`, `needsResearch`, `parseMapsLink`, `matchesPlaceFilter`, `newDraftPlace` | Locked fields (hand-edited) are never changed by research. |
| `trip-edit.ts` | `stayIssues`, `dayChanges` | When a stay moves, which stops lose their day. |
| `flights.ts` | `flightsOnDay`, `flightsOutsideDays`, `nextFlight`, `flightRoute`, `flightCostLabel`, `flightCostInYen`, `flightToForm`, `flightFromForm` | Dates and times stay local to each airport, as on the ticket, and are never converted. A flight's yen cost is its USD amount × `YEN_PER_USD`, rounded. Flights outside the days are those leaving on a date no stay covers. |
| `waiting-view.ts` | `applyWaitingView`, `isDefaultWaitingView`, `DEFAULT_WAITING_VIEW`, `WAITING_SORTS` | Sort (priority first, then name) and filters for the waiting list and its pins. The view is not saved. |
| `cleanup.ts` | `planCleanup`, `planEverything`, `CLEANUP_KINDS` | What Clean up will delete, from the retired records only. |
| `backup.ts` | `makeBackup`, `BackupSchema`, `backupSummary` | Whole-trip file, validated on import. |
| `activity.ts` | `undoFor`, `ActivitySchema` | Reverse of a change, if the target has not changed since. |
| `budget.ts` | `formatYen`, `formatUsd`, `formatUsdAt`, `usdToYen`, `parseUsd`, `parseRate` | Display and entry formats for yen and dollars. |
| `amount.ts` | `readAmount`, `entryFor`, `AmountEntry` | Turns a typed yen or dollar amount into the stored fields (§23.9). |
| `booking-cost.ts` | `bookingLabel`, `linkedExpense`, `bookingExpense` | A reservation's cost, kept as its linked expense (§12.5). |
| `i18n.ts` | `MessageKey`, `Translate` | Compile-time check that a message key exists. |
| `version.ts` | `versionFromDescribe` | `v1.0.0-3-gabc` → `1.0.3`. |
| `weather.ts` | `weatherKind`, `typicalWeather`, `yearsBefore` | WMO weather codes map to eight kinds. Typical weather averages the same dates over past years (highs, lows, % of years with ≥ 1 mm of rain, most common kind). |
| `sun.ts` | `sunTimes` | Sunrise, sunset and daylight minutes in Tokyo time, from the NOAA solar equations (about a minute's accuracy). Worked out on the device; no service. |

---

## 14. Google Maps and other external APIs

### 14.1 The rule

From `CLAUDE.md` rule 4 and `docs/maps-and-research-plan.md`:

- Screens reach Google only through `MapsService` (`src/domain/maps-service.ts`). The implementation is `GoogleMapsService`. The SDK is one script tag, added on first use.
- **Stored:** Google place IDs (indefinitely) and Google coordinates (at most 30 days; `maps:refresh` renews them). Our own notes can be stored.
- **In memory only:** hours, ratings, photos, route times and distances. Live details and photo lists are also kept for 30 minutes per place (`place-live-cache.ts`), never in storage, so a reload empties them.
- **Share copies** (§12.8) keep place IDs and Google coordinates as the trip does. Coordinates older than 30 days are dropped from the copy. `npm run maps:refresh` brings the copies' coordinates in line with the trip (renewed or deleted), so a copy never keeps them past 30 days. Copies hold no hours, ratings or photos.
- Google data appears only on a Google map or next to the Google logo. Never on another map provider.
- Weather and daylight are not Google data. City coordinates come from Open-Meteo's geocoding by the city's name, never from the Maps SDK or stored Google coordinates. Nothing is written to Firestore. Results stay in memory, with the `weather:*` localStorage cache described in §3.5.
- The browser key is public and restricted by website and API. The script key stays in a git-ignored `.env`.
- Google Cloud stays in its own projects, not the Firebase project's billing.

### 14.2 Calls the browser makes

| Call | Used for | Cost guard |
|---|---|---|
| Maps JS script (`maps.googleapis.com/maps/api/js`) | Map, markers, libraries (`maps`, `marker`, `core`, `routes`, `places`) | Loaded only when a map is first shown |
| `Route.computeRoutes` (walking) | Walking legs of a day | Cached in memory; stops after the daily cap |
| `AutocompleteSuggestion.fetchAutocompleteSuggestions` | Place suggestions when adding a place or a hotel | Session token per search |
| `Place.fetchFields` (`location`) | Coordinates for a chosen suggestion, when adding a place or a hotel (ends the billing session) | — |
| `Place.fetchFields` (`photos`, `regularOpeningHours`, and the live-detail fields listed in `google-maps-service.ts`) | Photos and live details, loaded when a place opens | `TAP_LIMITS` 30 per device per day each for `live` and `photo` (`tap-limit.ts`) |

Waiting-list pins on the Day page (`cityPins`) use only stored coordinates and make no calls.

Viewers of a share link make the same place-detail calls as members (photos and live details), under the same per-device daily limit.

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
| **Google Fonts** | IBM Plex Sans, Barlow Semi Condensed and Geist Mono, self-hosted at build | `layout.tsx` |
| **Open-Meteo** (`api.open-meteo.com`, `archive-api.open-meteo.com`, `geocoding-api.open-meteo.com`) | Forecast, typical weather and city geocoding for the day views (§12.3). Free, no key, called from the browser. No Google data. | `open-meteo.ts`, `use-weather.ts` |
| **Frankfurter** (`api.frankfurter.dev`, ECB reference rates) | Today's USD to JPY rate for entering and showing dollars (§12.5). One GET per session (`/v1/latest?base=USD&symbols=JPY`); no key; nothing else is sent. Falls back to the fixed `YEN_PER_USD` offline. | `usd-rate.ts` |
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
| 4. Data shape | Every write must match a whitelist of fields and types, with size limits and enums | `isPlanItem`, `isCity`, `isStay`, `isReservation`, `isHoliday`, `isFlight`, `isPlace`, `isExpense`, `isCash`, `isTodoList`, `isTodo`, `isProposal`, `isActivity`, `isBudget`, `isUserProfile`, `isNewTrip`, `isTripEdit` |
| 5. Document ID match | Every write checks that the document ID equals the record's `id` field | each `match` block |
| 6. Deletes | Only retired records can be deleted (archived, removed, dismissed, applied); share links only once closed or expired; trips are never deleted; activity can be deleted by members | each `allow delete` |
| 7. App gate | Nothing renders or listens before a member is confirmed | `AppGate`, `use-trip-sync`, `use-plan-sync`, `useAuthStore.access` |
| 8. Local data | Sign-out wipes the offline cache for this device; a version change clears storage but keeps preferences | `auth.ts` `endSession`, `app-reset.ts` |
| 9. Share links | The link is the only key (a 128-bit share ID). Anyone with it reads the copy while the link is open; members read and manage the link without the copy being open. No sign-in | `shares` rules (§15.2), `share.ts` |

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
- **Trip subcollections** (`cities`, `stays`, `reservations`, `holidays`, `expenses`, `flights`, `cash`, `places`, `proposals`, `items`, `activity`, `todoLists`, `todos`): read and write for members, with the schema check on each write. Delete only if already retired.
- **`expenses`:** `paymentMethod` is optional and must be `card` or `cash` (missing reads as `card`).
- **`budget`** (on the trip document): `byMember` is optional, a map of at most 20 entries.
- **`cash/{id}`:** members only. `isCash` checks the field whitelist and types. A handover needs a `to` different from `by`. Delete only when `archived` is true.
- **`shares/{shareId}`:** `get` is allowed to anyone while the link is open (`revoked == false` and `request.time < expiresAt`), and to members of its trip. `list` is for members only, with a query on `tripId`. `create` and `update` are for members only, through `isShare`: at most 30 days ahead (plus 1 hour of clock drift), `tripId` and `createdAt` unchanged, and a revoked link cannot be reopened. `delete` is for members only, once the link is revoked or expired.
- **`shares/{shareId}/{cities|stays|reservations|places|holidays|flights|items}/{id}`** (the copy): read while the link is open, or by members. Writes are for members only and must pass `isSharedCopy`: the existing field checks, with no amount, confirmation or booking note, plan items not `removed`, and no other collection name. This is the only data readable without sign-in.
- **`todoLists/{id}` and `todos/{id}`:** members only, through `isTodoList` and `isTodo` (exact keys, enum values, length limits, `dueDate` as `YYYY-MM-DD` or null, `assignee` an email or null). Delete only when `archived` is true. Not copied to share links (`isSharedCopy` has no to-do collection).
- **`items`:** a plan item may hold only `id`, `placeId`, `date`, `order`, `status` and `updatedAt`. The old stop fields (`startTime`, `durationMin`, `note`, `legNote`) are refused.
- **`queue`** (legacy): members can read and delete, nothing else.
- **`dayResearch/{date}`:** read, create and update for members, with `id` equal to the date and the `isDayResearch` shape (exact keys, status `requested`, `ready` or `archived`, request at most 1000 characters, analysis null or a map). Delete only when `status` is `archived`. Not copied to share links.
- **`activity`:** written once, never updated. Members can delete (for Clean up).

### 15.3 Other security measures

- **No secrets in the repo.** Firebase web config and the Maps browser key are public identifiers; the rules and Maps restrictions protect them. The Maps script key is in `.env` (git-ignored). Admin access uses `gcloud auth application-default login` or a service-account key kept outside the repo (`*.pem` is ignored).
- **Privacy rules** (`CLAUDE.md` rule 9): no hotel confirmations, booking references, ID numbers or member emails in the repo. Trip IDs live in links and in Firestore only.
- **Flight confirmation numbers** live only in Firestore and in the git-ignored `research/` file that `flights:push` reads. They are never committed to the repo.
- **Trip ID format** is checked (`TRIP_ID_PATTERN`) before use.
- **Sign-in popup** rather than redirect (the redirect flow needs the auth domain to be the site's own).
- **Sign-out** signs out of Firebase, terminates the Firestore client, and clears the offline cache for the trip (`clearIndexedDbPersistence`), then reloads.
- **Cost guard:** per-device daily limit on paid Google calls (`tap-limit.ts`), kept in storage and enforced even when storage is blocked.
- **Tokens and keys** in Maps: `maps:check` verifies the keys.
- **Content Security Policy:** none is set in the repo (static hosting on Pages gives no header control).
- **App Check:** code is present but off (`appCheckSiteKey = null`). Turning it on requires a reCAPTCHA v3 key and Firebase console setup.
- **Rules tests:** `tests/rules/firestore.rules.test.ts` (including the cash, payment method and per-member budget rules) run against the emulator: `npm run test:rules`. Java must be installed. The test project is `demo-itinerary`, so the real database is never touched.

### 15.4 What the rules do not cover

- Anyone who is a member can read and change every record of the trip. Membership is all-or-nothing; there are no per-field or per-role permissions.
- The Admin SDK scripts bypass the rules by design.
- Email is the identity key. Members are added by editing the trip document in the console or through Settings → Trip.
- Anyone with a share link can read its copy until the link expires or is closed. The link is the only key, and only a member can close it (Close link). Closing is permanent.
- Everything in the copy is visible to anyone who has the link. §12.8 lists what the copy leaves out.
- `firestore.rules` must be pasted into the Firebase console for the share rules to apply. The deploy does not publish them (§4.3).

---

## 16. Sign-in, trips and access

| Concept | How it works |
|---|---|
| **Sign-in** | Google popup. Errors mapped to messages by `signInErrorKey`: popup blocked, unauthorized domain, operation not allowed, network, web storage blocked, too many attempts, account disabled (`SIGN_IN_ERRORS`). In the home-screen app, popup blocked, storage blocked and internal error show "close the app completely, open it again and try once more" (`auth.standaloneRetry`). The sign-in button waits at most 90 s; a failed sign-in toast has a "Try again" action. Redirect sign-in is still not used: it needs the auth domain on the site's own origin root, which a GitHub Pages project site does not have. |
| **Session** | Firebase keeps it in IndexedDB, so it survives reloads and works offline. |
| **Trip list** | `watchMyTrips(email)`: `where("members", "array-contains", email)`. Needs no index (single-field). |
| **Opening a trip** | From the link (`?trip=`), the remembered trip, the last trip, or the only trip. Opening another trip reloads the page. |
| **Waiting for a trip** | While the trip list has answered with trips but none is chosen yet, the splash stays up (§7). |
| **Membership check** | `watchAccess(tripId)` reads `trips/{id}`. Permission denied = not a member; missing = no such trip. |
| **Remembering** | localStorage key `trip-id`, plus `users/{uid}.lastTripId`. |
| **Members** | Trip settings add and remove emails (lowercase, at most 20). The list must always include the person saving it. |
| **New trip** | `config/access.tripCreators` must contain the email. Name required. |
| **Language** | Saved in `users/{uid}.language` and applied at sign-in. |
| **Sign-out** | Clears this device's trip cache. Unsynced edits are lost, which the UI warns about. |

### Testing sign-in on phones

Run this by hand on both phones before the trip:

1. In Safari (or Chrome on Android), sign in, then sign out.
2. Add the app to the home screen, open it from there and sign in. On iPhone the home-screen app keeps its own sign-in, separate from Safari.
3. Close the home-screen app completely, reopen it, and check you are still signed in and the trip opens.
4. Turn on airplane mode, reopen the app from the home screen, and check that the plan still shows.
5. If the sign-in window hangs, wait for the "Sign-in didn't finish" message and use Try again.

---

## 17. Offline, PWA and caching

### 17.1 Offline data

- **Firestore persistent cache** (`persistentLocalCache` with `persistentMultipleTabManager`): the trip is readable offline once it has been loaded. Writes made offline are queued and sent when the connection returns.
- **Listeners** keep working offline from the cache. A missing trip document from the cache does not count as "missing"; the app waits for the server (`metadata.fromCache`).
- **Offline screens:** while signed in but with no answer and no connection, `AppGate` shows "offline" rather than a spinner.
- **Banner:** `OfflineBanner` shows when offline (`useOnline`) and appends the number of writes waiting, if any.
- **Sync indicator:** `SyncStatus` in the header shows whether this session's edits have reached the server. It reads `useSyncStore.pending`, so an edit made offline reads "waiting" with a count and returns to "saved" once the connection comes back and the server confirms. `startup` covers edits queued before a reload: `MemberSync` calls `watchStartupWrites()` once the member's trip is live, which waits for those writes with `waitForPendingWrites`, and the status reads "saving" until they are sent. Read-only share links do not show it.
- **Persistent storage:** the browser may clear a site's storage under space pressure, or (Safari) after a while without a visit. Once a member's trip is live, `MemberSync` calls `requestPersistentStorage()` (`src/lib/storage-persist.ts`), which asks the browser to keep the copy (`navigator.storage.persist()`), only when it is not already kept. Chrome usually agrees by site engagement, Safari for home-screen apps. Settings → About shows whether the copy is kept and lets the member ask again (§12.6).
- **Walking routes and place details:** not stored offline (Google's terms); the day shows straight-line distances.

### 17.2 Service worker (PWA)

- `workbox-config.cjs` → `out/sw.js` with `generateSW`.
- Precaches `**/*.{html,js,css,json,png,svg,ico,webmanifest,txt,woff2}` in `out/`. Excludes `version.json`.
- `ignoreURLParametersMatching: [/.*/]`: query strings (`?trip=`, `?date=`) are ignored, so each page matches its one precached file.
- The recharts chunk is precached even though charts load on first use, so the charts still open offline (§2.2).
- `skipWaiting` and `clientsClaim`: a new worker takes over at once. `cleanupOutdatedCaches` removes old files.
- Registered only in production (`service-worker-register.tsx`), at `${BASE_PATH}/sw.js`.
- The `.txt` files (Next's route data) are cached so a page and its data come from the same build.

### 17.3 Install

- `manifest.ts`: name "Trip Planner", standalone display, theme colour and background `#f4f6fa` (`THEME_COLOR.light`), icons 192 and 512 px (`public/icon-*.png`), `start_url` and `scope` under the base path. Apple web-app meta in layout.
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
   - clears localStorage except `locale`, `theme`, `palette`, `device-name`, `sidebar-open`, `hide-amounts`, `display-currency`, `days-view`, `quick-expense-category` and `payment-method`;
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
- **Before first paint:** the inline `LANG_BOOT_SCRIPT` (`src/lib/lang-boot.ts`, in `<head>` of the root layout) sets `<html lang>` from the stored choice (key `LOCALE_STORAGE_KEY`, `"locale"`) or the browser language, so the static HTML's `lang="en"` is never what screen readers hear for Spanish users. Tests in `lang-boot.test.ts`.
- **Switching:** `setLocale` saves to localStorage and `<html lang>`, updates the store, and `LocaleRoot` remounts the app so every `t()` runs again.
- **Saved per person:** `users/{uid}.language`. Used on every device after sign-in.
- **Google Maps stays in English** (its text is English; `live-hours.ts` parses English).
- **Adding a language** (CLAUDE.md rule 13): new messages file, `LANGUAGES` in `user-repository.ts`, `INTL_LOCALE` in `i18n.ts`, and the rules' allowed language list in `firestore.rules` (`isUserProfile`).
- **Validation:** `scripts/validate.ts` checks both message files against `MessagesSchema`.
- **Capitals:** every message starts with a capital letter. `src/messages/messages.test.ts` checks it; an allowlist covers mid-sentence fragments such as `activity.*`. `reservationType.*` labels are capitalised, so code lowercases them where they sit mid-sentence.

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
- `items:clean` (`scripts/items-clean.ts`) removes `startTime`, `durationMin`, `note` and `legNote` from a trip's plan items, only with `--apply` (dry run by default). It needs `TRIP_ID`.
- The research file format is documented in `docs/research-run.md`.
- **Day research** (`dayResearch/{date}`, §23.20) runs alongside the place flow. `research:pull` also reads requested days: for each day it creates any missing place proposals for the day's stops and writes `research/days-<date>.json` with `dayBrief` (stop order, straight-line km between stops, sunrise and sunset of the first city, no coordinates). A request for a day no stay covers is archived. Bookings and flights go in as times and places only, never confirmations.
- `research:push` takes either the old list of place results or `{places, days}` (`ResultsFileSchema`). Each day analysis is written straight onto the day document as `ready` (`researchedAt` set); cancelled requests are skipped. Place results still become proposals for review.
- Analyses hold only the researcher's own words, never Google data. The rules for the analysis are in `docs/research-run.md`, section 6, "Day research".

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
| `typecheck` | — | `next typegen && tsc --noEmit` (typegen generates the route types first) | — |
| `drafts:pull` | `scripts/drafts-pull.ts` | Exports draft places to `research/` | No |
| `places:push` | `scripts/places-push.ts` | Writes researched places into the trip | Yes |
| `places:reset` | `scripts/places-reset.ts` | Shows what clearing all places would change; `-- --apply` does it | Yes, with `--apply` |
| `items:clean` | `scripts/items-clean.ts` | Shows which plan items hold the old stop fields (`startTime`, `durationMin`, `note`, `legNote`); `-- --apply` removes them | Yes, with `--apply` |
| `flights:push` | `scripts/flights-push.ts` | Saves flights from a file in the git-ignored `research/` folder (`-- research/<file>.json`); a flight with the same ID is replaced. Shows what would change unless `-- --apply` is added | Yes, with `--apply` |
| `research:pull` | `scripts/research-pull.ts` | Exports place and day research requests for a research run (`research/days-<date>.json` for days); creates missing proposals for the day's stops; archives requests for days no stay covers. Each day entry includes `sunrise` and `sunset` for the day's first city | Yes (proposals, archived requests) |
| `research:push` | `scripts/research-push.ts` | Writes research as proposals for review, and day analyses onto their day; never changes a place | Yes (proposals and day research) |
| `maps:check` | `scripts/maps-check.ts` | Checks Google keys and test train routes; `-- --embed` serves the Maps Embed test | No |
| `maps:match` | `scripts/maps-match.ts` | Saves place IDs and coordinates; reports doubtful matches | Yes |
| `maps:refresh` | `scripts/maps-refresh.ts` | Renews coordinates before 30 days; `--all` refreshes all | Yes |

Shared helpers:

- `scripts/admin-db.ts`: Admin SDK Firestore with application default credentials, for `projectId` `itinerary-f990b`.
- `scripts/maps-api.ts`: Places API (New) REST helper, using the script key.

Tests for scripts: `scripts/flights-push.test.ts`, `scripts/places-reset.test.ts`, `scripts/research-pull.test.ts`, `scripts/validate.test.ts`.

---

## 22. Testing and quality gates

### 22.1 Test setup

- **Vitest** with **jsdom**, configured in `vitest.config.mts`. Alias `@` → `src`. Tests: `src/**/*.test.{ts,tsx}` and `scripts/**/*.test.ts`.
- **Setup** (`src/test/setup.ts`): jest-dom matchers; Testing Library cleanup after each test; the activity repository replaced with the in-memory `LocalActivityRepository`; `ResizeObserver` stubbed (tooltips need it); `fetch` stubbed to reject, so no test reaches the network (a test that needs it stubs its own).
- **Charts in tests:** the app loads the recharts charts on first use (`src/components/charts-lazy.tsx`, via `next/dynamic`). The setup mocks `@/components/charts-lazy` for every test to return the real charts directly (the exports of `@/components/chart-parts` and `@/components/charts` as one module), because a dynamic import landing during a later test slowed it past its timeout (the read-only link test in `viewer.test.tsx` took up to 15 s under the full suite).
- **In-memory repositories** (`local-*.ts`) replace Firebase in tests. Nothing in tests touches the real database.
- **Fixture:** `src/test/fixture-trip.json` (made-up trip). Only tests import it.
- **Rules tests:** separate config (`vitest.rules.config.mts`), run on the emulator (§15.3).

### 22.2 Test coverage by area (files with tests)

72 test files in total, including the rules tests: most `src/domain` modules have a `*.test.ts`; `src/lib` has tests for actions, stores, sync hooks, versioning, reset, trip ID, tap limit, catalogue filters, i18n and the message capital-letter check (`src/messages/messages.test.ts`); `src/components` has tests for the app gate, screens, place details and the old-link redirect; `scripts` has four.

### 22.3 Quality gates

From `CLAUDE.md` rule 11, before finishing any change:

```bash
npm run test
npm run validate
npm run lint
npm run typecheck
npm run build
```

And after changing `firestore.rules`: `npm run test:rules`.

`npm run typecheck` runs `next typegen` before `tsc --noEmit`, because `next-env.d.ts` imports the generated `.next/types/routes.d.ts` (global types such as `LayoutProps`). Those files exist only after `next typegen`, `next dev` or `next build`, so a plain `tsc --noEmit` fails on a fresh checkout.

CI (§4.3) runs `test`, `validate`, `lint`, `typecheck` and `build`, in that order. Rules tests are manual.

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
shares/
  {shareId}                    one per share link (128-bit random ID, §12.8)
    cities/stays/reservations/places/holidays/flights/items/{id}   the copy the link shows
trips/
  {tripId}                     one per trip (ID generated by Firestore)
    activity/{id}              change log
    cities/{id}                cities
    stays/{id}                 hotel stays
    reservations/{id}          trains, hotels, tours, tickets, and older flight bookings
    holidays/{id}              holidays and closures
    expenses/{id}              spending
    cash/{id}                  cash withdrawals and handovers (never in budget totals)
    todoLists/{id}             to-do lists (§23.22)
    todos/{id}                 to-dos (§23.22)
    flights/{id}               flights, as printed on the ticket
    places/{id}                places (catalogue)
    proposals/{id}             research proposals
    dayResearch/{date}         day research: request and analysis, one per day (ID is the ISO date)
    items/{id}                 the plan: one document per stop
    queue/{id}                 legacy links from the old queue (read and delete only)
```

No other top-level collections are used by the app. Everything else is denied.

`shares` is the only top-level collection that can be read without sign-in, and only while a link is open. Its fields:

| Field | Type | Notes |
|---|---|---|
| `tripId` | string | The trip the copy comes from. Members list links by it. |
| `tripName` | string ≤ 100, or null | Name shown on the copy. |
| `label` | string ≤ 100 | Name of the link, seen only by members. |
| `createdAt` | ISO string (≤ 30) | Set at creation; cannot change. |
| `expiresAt` | timestamp | Link stops working at this time. At most 30 days (plus 1 hour) ahead of creation or change. |
| `revoked` | bool | `true` once closed. A revoked link cannot be reopened. |
| `publishedAt` | ISO string (≤ 30) | When the copy was last refreshed. |

Deletes: members only, and only once the link is revoked or expired.

### 23.2 Trip document (`trips/{tripId}`)

| Field | Type | Notes |
|---|---|---|
| `name` | string (1 to 100) | Trip name. |
| `members` | array of strings (1 to 20) | Lowercase emails. Membership is checked here. |
| `createdBy` | string | Email of the creator. Set at creation only. |
| `createdAt` | ISO datetime string | Set at creation. |
| `updatedAt` | ISO datetime string (≤30 chars) | Set on every update. |
| `budget` | map or absent | `totalJPY` (int ≥ 0 or null), `byCategory` (map of expense category → int ≥ 0), `travellers` (int 1 to 20 or null), `byMember` (optional map of member email → int ≥ 0 or null, at most 20 entries; a spending target per person). |

Only `name`, `members`, `budget` and `updatedAt` may change on update.

### 23.3 Plan items (`trips/{tripId}/items/{itemId}`)

| Field | Type | Notes |
|---|---|---|
| `id` | string (≤ 64) | Equals the document ID. |
| `placeId` | string (≤ 64) | Must point to a place ID (not checked by the rules; the app skips items whose place is missing). |
| `date` | string, 10 chars | `YYYY-MM-DD`. |
| `order` | string (≤ 64) | Fractional-index key within the day. |
| `status` | `planned`, `done`, `skipped`, `removed` | `done` and `skipped` are set by the Went and Skip buttons. |
| `updatedAt` | ISO string (≤ 30) | |

The rules refuse any other field, so the old stop fields `startTime`, `durationMin`, `note` and `legNote` cannot be written. `items:clean` (§21) removes them from existing items.

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
| `amountJPY` | int ≥ 0 | Whole yen. Every total counts this field. |
| `originalUSD` | number ≥ 0, or null | Dollars typed in the expense. Null when entered in yen. |
| `rateJPYPerUSD` | number > 0, or null | The rate used for the conversion. Null when entered in yen. |
| `category` | `flight`, `booking`, `transport`, `food`, `souvenirs`, `attractions`, `clothes`, `temples`, `other` | |
| `date` | `YYYY-MM-DD` | |
| `status` | `planned` or `paid` | Planned = agreed, not yet paid. |
| `paidBy` | string ≤ 254, or null | Email or name. Null (older records) counts under the trip's first member (`payerOf`). |
| `paymentMethod` | `card` or `cash` | Optional in the rules; the schema default is `card`, so records saved before the field read as card. |
| `placeId`, `reservationId`, `stayId` | string ≤ 64, or null | Links to what it pays for; those are not estimated again. |
| `cityId` | string ≤ 64, or null | Default null. The city the money was spent in. `stayId` keeps its meaning (the hotel's own bill). Allowed by `isExpense` as `optionalString(d.get('cityId', null), 64)`. |
| `note` | string ≤ 500, or null | |
| `archived`, `updatedAt` | | |

A reservation's cost is not a field on the reservation (§23.6). It is an expense with `reservationId` set (§12.5), and clearing the cost archives that expense.

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

shares/{shareId}.tripId ──► trips/{tripId} (copy only; the copy is a snapshot, refreshed on demand)

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
 ├─ dayResearch/{date} ── date (one per day)
 ├─ expenses/{id} ── placeId | reservationId | stayId (optional)
 ├─ cash/{id} ── date (withdrawals and handovers; no link to expenses)
 ├─ flights/{id} ── departDate, arriveDate (no links)
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
| Member | ten collection listeners (`TRIP_COLLECTIONS`, including `cash` and the to-do collections), full collections | While trip is open | No pagination; the whole trip is loaded. |
| Member | `items` listener | While trip is open | Plan. |
| Member | `proposals` listener | While trip is open | Research notice and review. |
| Member | `dayResearch` listener (`useDayResearch`) | While trip is open | Day research panel and calendar icons. |
| Member | `activity` orderBy `at` desc, limit 50 | Only while the activity sheet is open | Single-field order; no composite index. |
| Member | `activity` count and `queue` list | Only in Clean up | `getCountFromServer`, `getDocs`. |
| Member | `users/{uid}` get and merge-set | Sign-in and trip change | Profile. |
| Member | `shares` where `tripId ==` (list) | Settings → Share | Lists the trip's share links. |
| Anyone with an open link | `shares/{shareId}` get, then its copy (seven collections and `items`) | When the view opens, then every 10 minutes | No sign-in; read through the viewer app (`getViewerDb()`). |

The app needs **no composite indexes**. There is no `firestore.indexes.json` in the repo; the Firebase console has none to publish.

### 23.16 Write patterns

- Each change writes **the whole document** (`setDoc`), so the rules see every field.
- Plan changes write only the changed items.
- Bulk writes use `writeBatch` in chunks of 450.
- Trip-level writes: `updateTrip` (name, members, budget).
- Share writes: create writes the link and its copy; Refresh writes every copy record and deletes copies of records that are gone; Change expiry and Close update the link only. The trip is never written by share actions.
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
9. **Trip-wide budget** sits on the trip document, so any member can change it. Per-member targets (`byMember`) are there too, and any member can change them.
10. **Member list lock-out guard** only checks that the saver is in the list; any member can add or remove others.
11. **Unbounded growth:** activity and expenses have no retention limit; Clean up is manual.
12. **Schema drift risk:** Zod schemas and rules list the same fields by hand. A new field must be added in both, in `firestore.rules` and in `schemas.ts`, or writes fail or data is skipped on read.

---

### 23.19 Flights (`trips/{tripId}/flights/{id}`)

`id` (string), `airline` (1 to 100), `flightNumber` (1 to 20), `departDate` and `arriveDate` (`YYYY-MM-DD`), `departTime` and `arriveTime` (`HH:MM`), `departAirport` and `arriveAirport` (three capital letters), `departCity` and `arriveCity` (≤ 100 or null), `confirmation` (≤ 40 or null), `costAmount` (number ≥ 0 or null), `costCurrency` (`USD` or `JPY`), `note` (≤ 500 or null), `archived`, `updatedAt`.

Dates and times are local to each airport, as on the ticket, so an arrival can read earlier than its departure. They are never converted. Deletes: only when `archived` is true (§8.3). Older flight bookings stay in `reservations` (§23.6).

---

### 23.20 Day research (`trips/{tripId}/dayResearch/{date}`)

One document per trip day; the ID is the ISO date. Schema `DayResearchSchema`, rules `isDayResearch`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Equals `date`. |
| `date` | string `YYYY-MM-DD` | The trip day. |
| `status` | `requested`, `ready`, `archived` | |
| `request` | string ≤ 1000, or null | The member's message. |
| `analysis` | map or null | `DayAnalysisSchema`: `load` (`light`, `medium`, `heavy`), `loadReason`, `summary`, `warnings` (≤ 20 of `{kind: closed, conflict, timing, other; placeIds; text}`), `hints` (≤ 10 of `{name, text, placeId or null, mapsUrl or null}`), `answer` (or null), `sources` (`{url, note}`), `researchedAt`. Only the researcher's own words, never Google data. |
| `requestedAt`, `updatedAt` | ISO strings | |

Rules: members read, create and update, with `id` equal to the date. Delete only when `status` is `archived`. Not copied to share links.

### 23.21 Cash (`trips/{tripId}/cash/{id}`)

Records cash that moves without being spent: a withdrawal from a bank, or a handover of cash from one member to another. Schema `CashRecordSchema`, rules `isCash`. Cash never counts in the budget totals.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Equals the document ID. |
| `kind` | `withdrawal` or `handover` | |
| `date` | `YYYY-MM-DD` | |
| `amountJPY` | int ≥ 0 | Whole yen. |
| `amountUSD` | number ≥ 0, or null | Only for withdrawals: the dollars the bank charged, typed by hand. Never worked out from a rate. |
| `by` | email | Who withdrew the cash, or who handed it over. |
| `to` | email, or null | Who received the cash in a handover. Null for a withdrawal. Must differ from `by`. |
| `note` | string ≤ 500, or null | |
| `archived`, `updatedAt` | bool, ISO string | Delete only when `archived` is true (§8.3). |

Cash is included in backups, and Clean up deletes archived cash records. It is never in read-only share links (§12.8).

### 23.22 To-do lists and to-dos

Two trip collections. They sync through `TripRepository` like the other trip records, go into backups, and are written with `saveRecord` (`trip-actions.ts`). Neither is in read-only share links (§12.8).

**To-do lists:** `trips/{tripId}/todoLists/{id}`. Schema `TodoListRecordSchema`, rules `isTodoList`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Equals the document ID. |
| `title` | string ≤ 120 | |
| `description` | string ≤ 1000, or null | |
| `color` | `#rrggbb` | Colour dot for the list. |
| `order` | int | Sort position among the lists. |
| `archived`, `updatedAt` | bool, ISO string | |

**To-dos:** `trips/{tripId}/todos/{id}`. Schema `TodoRecordSchema`, rules `isTodo`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Equals the document ID. |
| `listId` | string | The list the to-do belongs to. |
| `title` | string ≤ 200 | |
| `description` | string ≤ 2000, or null | |
| `dueDate` | `YYYY-MM-DD`, or null | Compared with today in Japan time (`dueState`). |
| `status` | `todo`, `inProgress` or `done` | |
| `priority` | `low`, `normal` or `high` | |
| `assignee` | member email, or null | |
| `order` | int | Manual order within the list. |
| `completedAt` | ISO string, or null | Kept by `withStatus` (§13). |
| `archived`, `updatedAt` | bool, ISO string | |

Rules: members only, with fixed keys (the rules refuse any other field). Delete only when `archived` is true (§8.3). Clean up deletes archived to-dos and archived lists that no live to-do uses.

---

## 24. Known gaps and stale files

Removed on 2026-11-01: the Feasibility plan, docs/remaining-work-plan.md, links/nagoya.txt, src/lib/local-maps-service.ts (nothing imported it) and src/components/ui/scroll-area.tsx (unused shadcn component). docs/maps-and-research-plan.md was brought up to date the same day.

| Item | Status | What to do |
|---|---|---|
| `cn` npm package | Used instead of the usual `clsx` and `tailwind-merge` pair. | Works; note it when adding shadcn components. |
| Rules not in CI | `test:rules` and `lint` are not run by the deploy workflow. | Add to CI if wanted. |
| `firestore.rules` not deployed by CI | Must be pasted into the Firebase console. | Keep in the release steps (README). |
| App Check | Code present; off. | Turn on with a reCAPTCHA v3 key once the site is stable. |
| Shadcn sidebar mobile sheet | Has no trigger in the app; never opens on phones. | Intentional (the Days page covers it), or remove the sheet path. |
| Large component files | `day-plan.tsx` (about 630 lines), `dashboard-screen.tsx` (about 630) and `budget-screen.tsx` (about 300) were split into smaller files in the frontend audit (§3.3). Behaviour did not change. | Split further only if they grow again. |
| Day-side-panel | Not part of the split; still one file. | Split when next changed. |
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
| **Share link** | A read-only link to a copy of the trip, opened with `?share=` and no sign-in (§12.8). |
| **To-do** | A task in a to-do list (`trips/{id}/todos`, §23.22). Archived rather than deleted in normal use. |
| **Viewer mode** | The app state for a share link: read-only, no sign-in, no access to the real trip (§7). |
