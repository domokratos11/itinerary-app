# Remaining work plan

Written 2026-10-29, seven weeks before departure (Dec 15). It covers what is pending or missing after commit `dcc26a0` (place queue), with one Claude Code prompt per step.

For each prompt: start in plan mode, read the plan, approve it, then commit once `npm run test`, `npm run validate` and `npm run build` pass (CLAUDE.md rule 10).

## Where things stand

| Area | Today | Gap |
| --- | --- | --- |
| Place queue | Paste a Maps link, it is saved to `trips/{tripId}/queue`, listed and exportable | Add-only: the rules deny update and delete, so a queued link can't be edited, dismissed, given a city or put on a day. Plan items can only point at catalog places from `data/places/*.json`, so a queued link has nothing to point at. |
| Trip structure | Cities, stays and reservations are JSON files read at build time; `/day/[date]` and `/city/[cityId]` are pre-generated from them | Changing a hotel or a date means editing JSON and redeploying. Nothing can be changed from the app. |
| Recently changed | A Sheet on the day page listing every plan item in the trip, newest `updatedAt` first, with its date and status; removed items have Restore | Shows each item's current state, not what changed: a move shows only the new date, an edit isn't visible, there's no "who" and no time, it isn't on the home page, and queue changes aren't in it. |
| Drag and drop | dnd-kit reorder inside one day, only at 768px and wider; phones get up/down buttons | Reported as not working. There is no dragging between days and no dragging from the queue, and no write path for queue → day exists. |
| Stop details | `startTime`, `durationMin`, `note` and the `done` / `skipped` statuses exist in the schema | No screen sets them. |
| Navigation | Home lists days | No link from home to the city catalogs was found in `src/`; the catalog is reached only by URL. |
| Desktop | Home is a `max-w-md` column; day and city pages widen to `max-w-3xl` | One phone column centred on a wide screen, no navigation, no use of the extra space. |

## Decisions this plan makes

1. **The trip moves into Firestore.** Cities, stays (hotels), reservations and places are stored under the trip; `data/*.json` stays as the seed and the backup, still Zod-validated. The day list is derived in the browser from the live stays, so changing a check-out date changes the days at once.
2. **Routes become query-based.** A static export can't add pages after the build, so `/day/[date]` and `/city/[cityId]` become `/day/?date=2026-12-20` and `/city/?id=nagoya`, rendered on the client. This changes CLAUDE.md rules 3 and 5; prompt 2 updates them.
3. **A queued link becomes a place when you use it.** "Assign to day" (or "Add to city") creates a draft place from the link's name and coordinates and, for a day, a plan item. The next enrichment run fills in the research and marks it researched. The queue stays the inbox of links you haven't decided on.
4. **Nothing is hard-deleted.** Admin records, places and queue items get `archived: true`; plan items keep the `removed` status. The rules keep denying delete.
5. **Changes are logged.** An append-only `activity` collection records what changed, from what to what, and from which device, and powers a rebuilt "Recently changed".
6. **Still no Google Maps API.** See the cost analysis below; Maps URLs stay.

### Firestore layout after the change

```text
trips/{tripId}                      name, startDate, endDate (unchanged, read-only)
  cities/{cityId}                   id, name, color, archived, updatedAt
  stays/{stayId}                    id, cityId, hotelName, hotelMapsUrl, lat, lng,
                                    checkIn, checkOut, note, archived, updatedAt
  reservations/{reservationId}      id, type, date, time, from, to, note, archived, updatedAt
  places/{placeId}                  every PlaceSchema field + status ('draft' | 'researched'),
                                    source ('catalog' | 'queue'), archived, updatedAt
  items/{itemId}                    PlanItem (unchanged)
  queue/{queueId}                   QueuedPlace + status ('queued' | 'promoted' | 'dismissed'),
                                    cityId, placeId, updatedAt
  activity/{activityId}             at, device, kind, targetId, summary, before, after
```

Keep booking references, confirmation numbers and ID numbers out of every `note` field: anyone with the trip link can read them (CLAUDE.md rule 9 applies to Firestore too).

Expected Firestore use stays far inside the free Spark limits: about 300 places, 30 stays and reservations and 150 plan items is roughly 500 documents per full load; two people opening the app 10 times a day is about 10,000 reads, against 50,000 free per day, and the offline cache serves most opens.

## Step 0: install the design plugin (you, once)

Plugin commands open an interactive dialog, so they can't run from this chat. In a terminal, in this folder:

```bash
claude
```

Then inside Claude Code:

```text
/plugin marketplace add anthropics/claude-code
/plugin install frontend-design@claude-code-plugins
```

The first line is only needed if the `claude-code-plugins` marketplace isn't added yet. Restart Claude Code afterwards so the skill loads; prompt 8 uses it.

Also commit the pending queue-panel change (the awaited save with an error toast, plus its test) before prompt 1.

## Prompts

### Prompt 1: fix drag and drop inside a day (target Nov 1)

The order logic in `handleDragEnd` (`src/components/day-plan.tsx`) looks correct, so the failure is more likely elsewhere. Suspects: duplicate `order` keys (two phones adding to the same day compute the same key, and `generateKeyBetween(a, a)` throws, which shows up as "That change was refused"), the drag handle not receiving pointer events, or the list re-rendering from a stale snapshot.

```text
Drag-to-reorder on the day page (src/components/day-plan.tsx, wide screens only) doesn't work. Find the actual cause before changing anything:
- Run the dev server, open a day with at least three stops at 1280px wide, and drag a stop by its grip. Check the console, the toast and whether the Firestore write happens.
- Check whether two items on the same day can have equal order keys; keyBetween(a, a) throws in fractional-indexing. If so, make keyAt in src/domain/plan.ts handle equal or out-of-order neighbours (re-key the day if needed) and add tests for it.
- Show the dropped order immediately (optimistic local order) so the card doesn't jump back while the save is pending.
- Add a keyboard sensor so reordering also works with the keyboard.
Add tests that reproduce the cause first, then fix it. Report what the cause was.
```

### Prompt 2: move the trip into Firestore (target Nov 6)

```text
Move the trip structure from build-time JSON into Firestore, following docs/remaining-work-plan.md ("Decisions" and "Firestore layout").

1. Schemas in src/domain/schemas.ts: add id, archived and updatedAt to City, Stay and Reservation; add status, source, archived and updatedAt to Place. Keep the data/*.json files valid against the seed versions of these schemas.
2. Repositories: a TripRepository interface in src/domain (subscribe to cities, stays, reservations and places; save one record), a Firestore implementation in src/lib and a memory one for tests. Screens never import Firebase (rule 6). Feed a Zustand store the same way usePlanSync does.
3. Seed script: scripts/seed.ts (npm run seed) that reads data/*.json and writes them into a trip, taking the trip ID from the TRIP_ID environment variable only. It never overwrites a document that already exists unless --force is passed. Print a summary.
4. Rules: extend firestore.rules with a validator per collection (exact keys, types, string lengths, checkOut > checkIn), create and update allowed only if the trip exists, delete always denied.
5. Routes: replace /day/[date] and /city/[cityId] with /day/?date= and /city/?id= Client Components that read the stores. deriveDays runs on the live stays. Show a clear empty state while the trip loads and when a date or city doesn't exist. Update the service worker config so the new pages work offline.
6. Plan items whose date is outside the trip, or whose place's city no longer covers that date, appear in a "Needs a new day" list on home with a Move action.
7. Update CLAUDE.md rules 3 and 5 to describe the new split (Firestore is the source of truth for the trip; data/ is the validated seed and backup) and keep everything else in it.
Add tests for the repositories, the rules validators (as pure functions mirroring them) and the "needs a new day" logic. Print the new rules file so I can publish it.
```

After: publish the rules, run `TRIP_ID=<your id> npm run seed` locally, open the app with `?trip=`.

### Prompt 3: admin screens for cities, hotels and reservations (target Nov 10)

```text
Add a Trip settings area at /settings/ (Client Component, reached from a header button) with three tabs built from shadcn/ui: Cities, Stays, Reservations.
- Cities: name and color, add, rename, archive. A city with stays or places can't be archived until they are moved.
- Stays: city, hotel name, Google Maps link (parsed with parseMapsLink for name and coordinates), check-in, check-out, note. Show the stays as a timeline of the trip, warn about gaps and overlaps, and preview which days are added or removed and how many plan items would need a new day before saving.
- Reservations: type, date, time, from, to, note.
Forms use react-hook-form with the Zod schemas if shadcn's form component fits; dates are trip dates in Asia/Tokyo (rule 7). Every save goes through TripRepository and writes an activity entry (see prompt 6; add the activity write here as a small function prompt 6 will extend).
Show a one-line reminder on note fields not to enter booking numbers. Mobile-first at 390px. Add tests for the gap/overlap check and the day-change preview.
```

### Prompt 4: queue lifecycle, edit and assign (target Nov 14)

```text
Turn the place queue into a working inbox (src/components/queue-panel.tsx, src/domain/queue.ts, firestore.rules).
- Add status ('queued' | 'promoted' | 'dismissed'), cityId, placeId and updatedAt to QueuedPlace. Allow update in the rules (same validator, id unchanged); delete stays denied.
- Each queued row gets Edit (name, note, city), Dismiss (with Undo) and Assign.
- Suggest the city from the link's coordinates: the city whose hotel is nearest, within 30 km; otherwise ask.
- Assign opens the same day picker as AddToDay (Drawer on phones, command palette on desktop), limited to the days that city covers. Choosing a day creates a draft place (status 'draft', source 'queue', the link's name, coordinates and mapsUrl, null research fields) and a plan item on that day, and marks the queue item promoted with its placeId. "Add to city only" creates the draft place without a day.
- Draft places show a "Not researched yet" badge everywhere they appear.
- Filter tabs: Queued, Promoted, Dismissed.
- Update the enrichment workflow: a script (npm run queue:pull) that exports queued and draft items for research, and npm run places:push that writes researched places back and sets status 'researched'. Both take TRIP_ID from the environment.
Add tests for the city suggestion, the promote action and the panel's edit and assign flows.
```

### Prompt 5: drag between days and from the queue (target Nov 18)

```text
Extend dnd-kit on wide screens (768px and up):
- On the day page, a side panel lists the queued and draft places for that day's cities; drag one into the day's list at a position to promote it (prompt 4's action) and place it there.
- On home (desktop layout), drag a stop from a day onto another day card to move it to the end of that day.
- Dropping a place whose city doesn't cover the target day is refused with a short explanation.
- Every drop writes through plan-actions / queue-actions and shows the result at once, with Undo in the toast.
Phones keep tap-based actions (Assign, Move to…, up/down); no dragging below 768px.
Add tests for the drop-to-index logic and the city check, and add a Playwright test at 1280px that drags a stop and a queued place and checks the saved order (use the memory repositories).
```

### Prompt 6: edit stops and rebuild "Recently changed" (target Nov 22)

```text
1. Stop editing: tapping a stop opens a Drawer (phone) or Sheet (desktop) to set start time, duration (default from the place), note, and mark Done or Skipped. Show the day's time line when start times are set, and warn when a stop starts outside the place's opening hours text or the day runs past 22:00.
2. Activity log: an append-only trips/{tripId}/activity collection (create only in the rules) with at, device (a name chosen once per phone, kept in localStorage, e.g. "Rey's phone"), kind (added, moved, reordered, edited, removed, restored, queued, assigned, dismissed, settings), targetId, a one-line summary, and small before/after values. Write one entry from every action in plan-actions, queue-actions and the settings saves.
3. Replace the current Recently changed Sheet with an Activity Sheet reachable from every page: the last 50 entries grouped by day, "Rey's phone moved Nagoya Castle from Dec 25 to Dec 26 · 14:02", with Undo on entries whose target hasn't changed since.
Add tests for summaries and for the "can undo" check.
```

### Prompt 7: missing pieces that matter on the trip (target Nov 28)

```text
Add, in this order, committing after each:
1. Navigation: a header on every page with Trip days, Cities (all cities, linking to /city/?id=), Queue and Settings; the city badges on day cards link to their catalog.
2. Today mode: during the trip, home opens on today's day (Asia/Tokyo) with the next stop and its directions at the top.
3. Year-end closures: a list of Japanese holiday dates for the trip (Dec 29 to Jan 3, Coming of Age Day Jan 11, 2027) in data/, validated; a warning on stops at places whose hours are unknown or marked closed on those dates.
4. Full backup: Export downloads the whole trip (cities, stays, reservations, places, plan, queue) as one JSON in the data/ seed shape; Import (on Settings) restores it into an empty trip after a confirmation.
5. Search: a command palette (Ctrl+K on desktop, a search button on phones) over all places, days and hotels.
Keep each one mobile-first and tested.
```

### Prompt 8: desktop design pass (target Dec 3)

Run after step 0.

```text
Use the frontend-design skill. The phone design is good and must not change below 768px. Redesign the wide layouts:
- An app shell at 1024px and up: a left sidebar with the trip, the day list (city colour, stop count, today marked) and links to Cities, Queue, Activity and Settings; the main area shows the selected page.
- Day page: stops in the centre, a right column with the hotel start and end, reservations, cost and the queue panel from prompt 5.
- Home: a calendar-style grid of the trip's days grouped by stay, instead of one long column.
- City page: catalog filters in a side column, places as a two- or three-column grid, details in a Sheet.
- Consistent page headers, spacing and type scale; light and dark mode both checked.
Use shadcn/ui components (sidebar, resizable, etc. via npx shadcn@latest add) before custom ones. Take screenshots at 390px, 1280px and 1920px before and after, and list what changed.
```

### Prompt 9: full review before departure (target Dec 10)

```text
Review the whole app as two testers: one on a 390px phone, one on a 1440px laptop, in light and dark mode and in airplane mode. Walk through: change a hotel's dates in Settings and confirm the days follow; queue a link, assign it to a day and drag it into place; edit a stop; undo from Activity; export and re-import into a test trip. List bugs and confusing flows, fix them, run tests, validation and build, and summarize.
```

After: export the trip and commit it to `data/` as the backup; install the app on both phones again.

## Google Maps API: can it be free?

Short answer: the app's current use is free and always will be. The APIs have free monthly allowances that this trip would stay under, but every one of them needs a Google Cloud billing account with a card, so "free" means "$0 as long as usage stays under the caps", not "can't be charged".

| What | Key | Card / billing account | Free allowance | Fit for this app |
| --- | --- | --- | --- | --- |
| **Maps URLs** (what the app uses now) | No | No | Unlimited | Place pages and transit directions in the Maps app. Stay here. |
| **Maps Embed API** (an iframe map) | Yes | Yes, to create the key | Unlimited, no charge | A static map of one place or one route inside the page. No custom markers for a whole day. |
| **Maps JavaScript API** (interactive map) | Yes | Yes | About 10,000 map loads a month (Essentials), then about $7 per 1,000 | Two people would use a few hundred loads a month, so $0 in practice. |
| **Places API** (hours, ratings, photos) | Yes | Yes | About 10,000 (Essentials) or 5,000 (Pro) calls a month per SKU; opening hours are in the Pro tier | Could feed the enrichment run (about 300 places, once), so $0 in practice. |
| **Routes API** (travel times inside the app) | Yes | Yes | About 10,000 (Essentials) a month; transit is in a higher tier | Not needed: Maps URLs already give live transit in the Maps app. |

Since March 1, 2025, Google replaced the old $200 monthly credit with these per-SKU free caps; they reset each month and don't pool across SKUs. Check the [official price list](https://developers.google.com/maps/billing-and-pricing/pricing) before relying on the exact numbers above.

Risks if you add an API:

- **The key is public.** This is a static site in a public repo, so the key ships in the page. Restrict it to the `domokratos11.github.io` referrer and to the one API, and set a daily request quota in the Cloud console. Budget alerts only email you; they don't stop charges.
- **Don't use the Firebase project.** A Firebase project is a Google Cloud project; linking a billing account to it moves Firebase from Spark to Blaze, which removes the "can never be billed" guarantee for Firestore. Use a separate Cloud project for Maps.
- **CLAUDE.md rule 4** forbids the API today; adding one means changing that rule on purpose.

Recommendation: keep Maps URLs. If you want a map of the day inside the app, use **Leaflet with OpenStreetMap tiles** (no key, no card, fine for two users under OSM's tile policy) or the free **Maps Embed API** in a separate Cloud project. If you want Google data for enrichment, a one-off Places API run from your machine in a separate project stays inside the free cap.

## Risks

| Risk | Mitigation |
| --- | --- |
| Prompt 2 is the biggest change and touches every page | Do it right after the drag fix, before anything else builds on the old routes; seed into a second test trip first |
| An edit to stays strands plan items | The settings preview counts them before saving; "Needs a new day" lists them after |
| Two phones edit the same stop | Last write wins per item; Activity shows who changed what, with Undo |
| Time runs out | Prompts 1 to 4 are the must-haves (by Nov 14); 5 to 8 can be cut in reverse order; the app works without them |

Sources: [Google Maps Platform pricing overview](https://developers.google.com/maps/billing-and-pricing/overview), [Maps Embed API usage and billing](https://developers.google.com/maps/documentation/embed/usage-and-billing), [Maps Embed API quickstart](https://developers.google.com/maps/documentation/embed/quickstart), [Woosmap: Is Google Maps API free in 2026](https://www.woosmap.com/blog/is-google-maps-api-free), [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans).
