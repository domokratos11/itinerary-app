# Maps and place research plan

Written 2026-10-30, about six and a half weeks before departure (Dec 15). This replaces decision 6 ("Still no Google Maps API") in [remaining-work-plan.md](remaining-work-plan.md).

There are two separate tracks:

- **Track A, Google Maps:** pins, distances, trains and photos, shown live.
- **Track B, place data:** editing a place by hand, and filling in its information with AI research.

## What the code shows today

| Finding                                                            | Why it matters                                                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Only 12 of 227 places have coordinates (all in Nagoya)             | A map can't show the other 215 until they are matched to Google places. This comes first.                                                                    |
| Only 9 places have a cost, 12 a duration and 11 a description      | This is why Ueno Zoo says "Not researched yet".                                                                                                              |
| `seedTrip` marks every catalog place `researched`, even empty ones | `queue:pull` only exports `draft` places, so Ueno Zoo and the other empty places **never reach the research run**. This is the real blocker in today's flow. |
| The app has no screen for editing a place                          | Cities, stays and bookings can be edited in Settings. Places can only change through scripts.                                                                |
| Plan items and places have no travel information                   | `geo.ts` only gives straight-line distance, and directions are a link out to Maps.                                                                           |

## What Google allows, and what shapes this design

**Trains are the main limitation.** The Routes API has a `TRANSIT` mode, but developers consistently report empty results for Japan, or a walking route returned instead. Google's documentation doesn't state this limit for Japan, so M0 tests it with one real call. The plan assumes it fails. The Google Maps _app_ does show Japanese trains, so links out to it keep working.

**Google's data mostly can't be stored.** This corrects something said earlier in this project: Places data can't fill the research fields permanently, because Google's policy forbids storing it.

| Data                                                        | Store in Firestore?                                | Source                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Google place ID                                             | Yes, indefinitely                                  | Places policy                                                            |
| Latitude and longitude                                      | Up to 30 days, then refresh or delete              | Service terms 14.3, current text (see "M0 results")                      |
| Hours, rating, price level, website from Google             | No, fetch live                                     | Places policy                                                            |
| Photos and their URLs                                       | No, fetch live, and show the photographer's credit | Places policy and photo docs                                             |
| Route times and distances                                   | No, keep in memory for the session                 | Service terms 19.3 allow caching only latitude and longitude from Routes |
| Our own research from official sites, and anything you type | Yes, it is ours                                    |                                                                          |

So each place shows two kinds of information: **our notes** (stored, work offline) and **live from Google** (fetched when asked, online only). If Google's data appears without a Google map, the Google logo must be shown too.

**Cost at this size is very likely $0, as long as daily caps are set:**

| Use                           | Google product and tier   | Free per month | Expected use      |
| ----------------------------- | ------------------------- | -------------- | ----------------- |
| Match 227 places to place IDs | Text Search, IDs only     | Unlimited      | Once              |
| Load photo references         | Place Details, IDs only   | Unlimited      | Each open         |
| Coordinates                   | Place Details Essentials  | 10,000         | About 230 a month |
| Show a map                    | Dynamic Maps              | 10,000         | Hundreds          |
| Walking time and distance     | Compute Routes Essentials | 10,000         | Hundreds          |
| Open status, rating, hours    | Place Details Enterprise  | **1,000**      | Only when tapped  |
| Photo images                  | Place Details Photos      | **1,000**      | Only when tapped  |
| One route in an iframe        | Maps Embed                | Unlimited      | Optional          |

## Track A: the map

### Setup

Step-by-step instructions are in [maps-setup.md](maps-setup.md).

- **Two separate Google Cloud projects with their own billing,** one for the app and one for scripts. Linking a card to the Firebase project moves it from the free Spark plan to Blaze and removes the "can never be billed" guarantee.
- **Browser key:** public, as with any static site. Allow only `https://domokratos11.github.io/*` and `http://localhost:3000/*`, and only Maps JavaScript, Places (New), Routes and Maps Embed.
- **Script key:** Places (New) only, kept in a git-ignored `.env`.
- **Daily caps** on every API. A cap is what stops spending; a budget alert only sends an email. Caps apply per API method, not per price tier, so the app project caps Place Details at 60 a day and the app also limits tapping on its side (M6).

### What you will see

| Screen        | Phone (390px)                                                                                                           | Desktop                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Day           | A `List / Map` switch. The map has numbered pins in stop order, the hotel as start and end, and the walking route.      | Map in the right column, list in the centre |
| City          | A `List / Map` switch. Pins are coloured by category, with must-see places emphasised, and follow the existing filters. | Map beside the grid                         |
| Tapping a pin | Opens the existing Place details                                                                                        | Same                                        |

Between two stops on the day list, a line shows the leg:

- **Short leg:** `Walk 12 min · 900 m`
- **Longer leg (over about 1.5 km):** `About 4 km` with a **Train directions** button that opens the Maps app in transit mode, and any train note you have stored (see "Trains").

Offline, the list keeps working with straight-line distances and the map shows a short message. The map code loads only when the map is opened.

### Trains, in layers

1. **M0 test:** one Routes `TRANSIT` call and one Maps Embed `mode=transit` iframe, Ueno to Asakusa. The iframe is free and may behave differently from the API. If either works, it replaces layer 2's links.
2. **Links to the Maps app:** already in the code (`src/domain/plan.ts`), and they do show Japanese trains.
3. **Nearest station on each place:** researched and stored by Track B, for example `Ueno Station, Ginza Line, 4 min walk`.
4. **Train notes on a leg:** line, minutes and fare, typed by hand or suggested by research, and stored because they are ours. Treat these as estimates.
5. **Station pins on the map:** an optional live toggle using Nearby Search. Check its tier in M0.

Shinkansen and other booked trains already live in reservations; the day view keeps showing them. A paid Japanese transit API (NAVITIME and similar) stays out of scope, since you asked for Google and it adds a provider.

### Photos and live details

In Place details:

- **Photos** show one image when you tap **Show photo**, then a swipeable gallery of up to 10, each with its photographer's credit and a link to the original on Google Maps.
- **Live from Google** shows open status, rating and today's hours when you tap it. If it disagrees with our stored hours, the app flags the difference.

Neither loads automatically or appears in lists, which is what keeps them inside the 1,000-a-month allowance. Each device also stops at 15 of each a day, because a Cloud cap can't target one price tier.

### Firestore changes

| Where                | New field                                                  | Notes                                                  |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `places`, `stays`    | `googlePlaceId`                                            | Stored indefinitely                                    |
| `places`, `stays`    | `locationFetchedAt`, `locationSource` (`google`, `manual`) | Only `google` coordinates are refreshed                |
| `places`             | `nearestStation` (`name`, `lines`, `walkMin`)              | From research, ours                                    |
| `places`             | `sources` (`field`, `url`)                                 | Where each researched fact came from                   |
| `places`             | `lockedFields`                                             | Fields you edited by hand; research never changes them |
| `items`              | `legNote` (`mode`, `minutes`, `fareJPY`, `text`)           | Optional train note for reaching this stop             |
| new `proposals/{id}` | See Track B                                                | Research waiting for your review                       |

All new fields are optional in `firestore.rules` and default to null in Zod, the same way the queue's later fields were added, so existing documents stay valid. `isMember` guards `proposals` as well. `backup.ts`, `seed.ts` and the validators are updated with them. No Google hours, ratings, photos or routes are written anywhere.

Code follows the existing pattern: a `MapsService` interface in `src/domain`, one Google implementation in `src/lib` and a memory one for tests. Screens never import the Maps SDK. All SDK code lives in the Google implementation, including the map, so no React wrapper is needed; `@vis.gl/react-google-maps` would have added a second script loader for no gain.

## Track B: place data

### Administration: editing a place

- **Edit button in Place details** opens a form (Drawer on phones, Dialog on desktop, the same split as the other editors) with every field, using shadcn components and the existing Zod schema. Saves go through `saveRecord`, so they get the activity log and Undo. A field you change is added to `lockedFields`.
- **Places tab in Settings:** a list by city with filters like **Missing cost**, **Missing hours**, **No map pin**, **Has research to review**. Tick several places and press **Research**.
- **Add place:** type a name or paste a link, choose from Google's suggestions, and it is saved with its place ID as a draft.
- **Completeness instead of status:** "needs research" is worked out from the fields that are actually empty, which fixes the blocker above without relying on the stored `researched` label.

### Lookup: the options compared

| Option                                                                          | Effort for you                                            | Cost                                                                         | Verdict                                            |
| ------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| Separate tool, then copy and paste                                              | High, per place                                           | Low                                                                          | No, this is what you want to avoid                 |
| Google Places API to fill the fields                                            | Low                                                       | $0                                                                           | **Not allowed to store it.** Only useful live.     |
| Backend (Firebase Functions, Cloudflare Worker)                                 | Low after setup                                           | Needs Blaze or a new host                                                    | No, breaks CLAUDE.md rule 1                        |
| **Claude Code run** on your computer, using `research:pull` and `research:push` | One command, then review                                  | Uses your Claude plan, no API key                                            | **Start here**                                     |
| Script with the Claude API and web search                                       | One command, then review                                  | Roughly $25 to $35 for 215 places at Opus 5.5 (estimate, measure on 5 first) | Good if you want it repeatable without Claude Code |
| GitHub Action on a timer, running that script                                   | Press Research in the app; results arrive within the hour | Same API cost, plus secrets in GitHub                                        | Optional later, only if phone-only use matters     |

The estimate assumes about 3 searches ($10 per 1,000) and 15,000 to 30,000 input tokens per place at $4 per million, plus about 1,000 output tokens at $20 per million. Sonnet 5.5 at half the token price would lower it. Batches cut token costs by 50% but searches are throttled.

### The flow

The key idea is that **research never writes directly to a place. It writes a proposal that you approve.** A static site can't run research itself, but it can leave a request in Firestore for a worker to pick up, which means the worker can change later without touching the app.

```text
App: press Research (one place or many)
  -> proposals/{id}  status: requested
Worker (Claude Code now, GitHub Action later)
  -> reads requested proposals
  -> researches official sites, validates with Zod
  -> status: ready, with proposed fields and sources
App: "3 places have research to review"
  -> old value vs new value per field, with source links
  -> Accept all / accept per field / dismiss
  -> saved through saveRecord, with activity log and Undo
```

`proposals/{id}` holds `placeId` (Add place always saves a draft first, so a proposal never needs a name and link instead), `status` (`requested`, `ready`, `applied`, `dismissed`), `fields`, `sources`, `notes`, `requestedAt` and `updatedAt`.

Rules for the research worker:

- It only fills empty, unlocked fields. Corrections to existing values appear as a visible change to review.
- Each fact needs a source, official sites first. Year-end closures (Dec 29 to Jan 3) get explicit checks. Unknown stays null rather than guessed.
- Web pages are untrusted input. The output is validated against a schema and reviewed by you, and only `https` links are accepted.
- It doesn't copy Google's hours or ratings into a proposal.

## M0 results

Checked 2026-10-30 against the [service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) (last modified Oct 28, 2026).

| Question                                 | Answer                                                                                                                                                                                                                                                       | Effect on the plan                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can coordinates be stored?               | Yes, "for up to 30 consecutive calendar days, after which Customer must delete" them (14.3).                                                                                                                                                                 | `maps:refresh` stays. Google coordinates are also left out of `data/` and backups, since the repo is public and those copies would outlive 30 days. Coordinates you supply yourself (`manual`) are unaffected. |
| Can route times be stored?               | No. Only latitude and longitude from Routes may be cached (19.3).                                                                                                                                                                                            | As planned, memory only.                                                                                                                                                                                       |
| Other map providers?                     | Places and Routes content can't be used with a non-Google map (14.2, 19.2).                                                                                                                                                                                  | Rules out Leaflet for this data.                                                                                                                                                                               |
| Can a cap target one price tier?         | No. [Quotas are per API method](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing), and a field mask decides the tier. Whether Places (New) offers a per-day quota for every method still has to be seen in the console. | Two projects, a 60-a-day app cap on Place Details (about $16 in the worst month), and a limit inside the app.                                                                                                  |
| Nearby Search tier?                      | Pro at minimum (5,000 free a month), no IDs-only tier. `train_station` and `subway_station` are valid filters.                                                                                                                                               | Station pins are affordable if wanted in M7.                                                                                                                                                                   |
| Photo credit rules?                      | Author credit where space allows, plus a link to the original on Google Maps through `googleMapsUri`.                                                                                                                                                        | Added to M6.                                                                                                                                                                                                   |
| Prices in this plan?                     | All match the [current price list](https://developers.google.com/maps/billing-and-pricing/pricing). Autocomplete, used by Add place, has 10,000 free a month.                                                                                                | None.                                                                                                                                                                                                          |
| Does Routes `TRANSIT` work in Japan?     | No. Tested Ueno to Asakusa: no route returned, while `WALK` worked.                                                                                                                                                                                          | As assumed: the app can't read train times or lines as data. Walking legs are unaffected.                                                                                                                      |
| Does Embed `mode=transit` work in Japan? | Yes. Tested Ueno to Asakusa: the iframe draws the Ginza Line route, 5 min, every 3 min.                                                                                                                                                                      | An in-app train map is possible, free. It can only be displayed, so nothing from it can be stored or added up. Not built yet; Train directions still opens the Maps app.                                       |

## Milestones

Tracks A and B are independent after M1. M0 needs you for the Google Cloud setup.

| #   | Target | Work                                                                                                                                                                                      | Done when                                                                       |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| M0  | Nov 2  | Cloud project, keys, caps, Map ID. Test transit in Routes and Embed. Confirm the coordinate-storage rule and Nearby Search tier. Rewrite CLAUDE.md rule 4 and the "no embedded map" line. | Results recorded here and the layers adjusted                                   |
| M1  | Nov 5  | Schema and rules changes. `maps:match` script: place ID and coordinates for all places, with a report of doubtful matches to confirm. `maps:refresh` for the 30-day rule.                 | Nearly all places have a pin; rules published                                   |
| M2  | Nov 10 | Map on Day and City pages, numbered pins, `List / Map` switch                                                                                                                             | Works at 390px and on desktop, in light and dark, and offline shows the message |
| M3  | Nov 14 | Place editor, Places tab, completeness filters, Add place                                                                                                                                 | A place can be fully edited in the app, with Undo                               |
| M4  | Nov 20 | Proposals, review screen, `research:pull` / `research:push`. Test on 5 places, then run all of them.                                                                                      | Ueno Zoo has cost and duration with sources; nothing changed without review     |
| M5  | Nov 26 | Walking legs, distances, train button, `legNote`, nearest station                                                                                                                         | A full day shows each leg                                                       |
| M6  | Dec 1  | Photos and Live from Google, with credits and the Google logo                                                                                                                             | Tapping stays under the caps; caps reaching their limit shows a clear message   |
| M7  | Dec 5  | Optional: Claude API script or GitHub Action, station pins                                                                                                                                | Only if still wanted                                                            |

**Status, Oct 31, 2026: this stage of development is finished.** M1 to M6 are deployed and the real map is live. M7 was not built. What's left is running the scripts, not building: see [maps-checklist.md](maps-checklist.md). The billing account is on Google's Free Trial, which ends Jan 29, 2027: nothing is billed unless it's upgraded, so the daily caps weren't confirmed. Upgrading needs them first.

This leaves the full review from the earlier plan on Dec 10. If time runs short, cut from the bottom: M7, then M6. Each milestone ends with `npm run test`, `npm run validate` and `npm run build`.

## Risks

| Risk                                    | Mitigation                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| A card is on file and Maps is billable  | Separate project, daily caps on every API, tap-only premium features                     |
| The public key is copied                | Referrer and API restrictions, plus the same caps                                        |
| A place matches the wrong Google result | `maps:match` checks distance to the city and reports doubtful matches for you to confirm |
| Research is wrong or out of date        | Sources shown, review required, Live from Google as a cross-check                        |
| Research overwrites your edits          | `lockedFields`, and only empty fields are filled by default                              |
| Weak signal in Japan                    | The list, stored research and offline cache all work without the map                     |
| Stale coordinates past 30 days          | `maps:refresh` run before and during the trip                                            |

## Decisions for you

1. **Billing:** OK with a card on a separate Google Cloud project, with caps? _Recommended: yes. Without it, none of Track A is possible._
2. **Research worker:** start with Claude Code on your computer? _Recommended: yes. Add the API or GitHub Action only if you miss it._
3. **Trains:** OK with links to the Maps app plus stored notes if M0 confirms the API returns nothing? _Recommended: yes._

## Sources

- [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Place Details data fields and tiers](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Routes API transit routes](https://developers.google.com/maps/documentation/routes/transit-route)
- [Maps Embed API](https://developers.google.com/maps/documentation/embed/embedding-map)
- [Maps JavaScript place photos](https://developers.google.com/maps/documentation/javascript/place-photos)
- [Maps JavaScript Routes library](https://developers.google.com/maps/documentation/javascript/routes/overview) and [legacy services](https://developers.google.com/maps/legacy)
- [Service terms, 2018 archive](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20181015) and [third-party caching summary](https://openplacesapi.com/blog/can-you-store-places-api-results)
- Japan transit reports: [developer write-up](https://note.com/sylvacejp/n/n89a8e8887d38?hl=en), [mungchilog issue](https://github.com/jyje/mungchilog/issues/85), [noloroute PR](https://github.com/bukrathezer/noloroute/pull/30)
- [Claude web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
