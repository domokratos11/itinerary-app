# Google Maps setup

Everything here is done by hand in the [Google Cloud console](https://console.cloud.google.com/). It takes about 20 minutes. Never put a key in chat logs, issues or commits, except the browser key once it goes into `src/lib/maps.config.ts` (it ships in the page anyway and is protected by its restrictions).

Why two projects: Google's quotas are per API method, not per price tier, so Place Details calls from a script and from the app would share one daily cap. Refreshing 230 coordinates needs a high cap, while the app needs a low one because the same method can bill at the $20 per 1,000 tier. Separate projects let each have its own cap.

**Do not link billing to the Firebase project (`itinerary-f990b`).** That would move it from Spark to Blaze.

## 1. Billing account

1. Go to **Billing** and create a billing account with your card, if you don't already have one.
2. Open **Budgets & alerts**, create a budget of $1 for that account, and leave the email alerts on. This only notifies you; the caps in step 5 are what stop spending.

## 2. Create two projects

Create both and link them to the billing account:

| Project name             | Used by                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `itinerary-maps-app`     | The website (browser key)                                  |
| `itinerary-maps-scripts` | `maps:match`, `maps:refresh` on your computer (script key) |

## 3. Enable the APIs

Under **APIs & Services > Library**:

| Project                  | Enable                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| `itinerary-maps-app`     | Maps JavaScript API, Places API (New), Routes API, Maps Embed API |
| `itinerary-maps-scripts` | Places API (New)                                                  |

Pick **Places API (New)**, not the one called just "Places API". If the console offers to create a key while you enable an API, skip it and use step 4 so the restrictions get set.

## 4. Create and restrict the keys

Under **APIs & Services > Credentials > Create credentials > API key**.

**Browser key**, in `itinerary-maps-app`:

- Application restriction: **Websites**, with both of these:
  - `https://domokratos11.github.io/*`
  - `http://localhost:3000/*`
- API restriction: **Restrict key** to Maps JavaScript API, Places API (New), Routes API and Maps Embed API.

Use the site root, not `/itinerary-app/*`. Browsers send only the origin on cross-origin requests by default, so a path in the restriction can reject the app's own calls.

**Script key**, in `itinerary-maps-scripts`:

- Application restriction: None (it only runs on your computer).
- API restriction: **Restrict key** to Places API (New).

## 5. Daily caps

Go to **Google Maps Platform > Quotas**, pick the API from the dropdown, and lower the **per day** quota. When a cap is reached, requests fail until midnight Pacific time and nothing more is billed.

`itinerary-maps-app`:

| API                 | Method                         | Per day | Worst month if it hits the cap every day      |
| ------------------- | ------------------------------ | ------- | --------------------------------------------- |
| Maps JavaScript API | Map loads                      | 300     | Free (9,000 of 10,000)                        |
| Places API (New)    | Place Details (`GetPlace`)     | 60      | About $16 (1,800 at the top tier, 1,000 free) |
| Places API (New)    | Photo media (`GetPhotoMedia`)  | 30      | Free (900 of 1,000)                           |
| Places API (New)    | Text Search (`SearchText`)     | 50      | Free at the tier the app uses                 |
| Places API (New)    | Nearby Search (`SearchNearby`) | 30      | Free (900 of 5,000)                           |
| Places API (New)    | Autocomplete                   | 100     | Free (3,000 of 10,000)                        |
| Routes API          | Compute Routes                 | 200     | Free (6,000 of 10,000)                        |

`itinerary-maps-scripts`:

| API              | Method                     | Per day |
| ---------------- | -------------------------- | ------- |
| Places API (New) | Place Details (`GetPlace`) | 500     |
| Places API (New) | Text Search (`SearchText`) | 500     |

**Google's docs are unclear on one point.** The Places page describes only per-minute limits, while the cost page says to lower the per-day quota. If a row above has no per-day option, tell me which ones, so the app can enforce a limit itself and the plan can be adjusted.

## 6. Map ID

In `itinerary-maps-app`, go to **Google Maps Platform > Map Management > Create Map ID**. Name it `itinerary`, type **JavaScript**, **Vector**. The ID isn't secret.

## 7. Put the keys on your computer

Create a file named `.env` in the repo folder. It is git-ignored.

```text
GOOGLE_MAPS_BROWSER_KEY=...
GOOGLE_MAPS_SCRIPT_KEY=...
```

Then put the browser key and Map ID in `src/lib/maps.config.ts`, which is committed. They ship in the page anyway. The script key never goes there.

## 8. Check it

```bash
npm run maps:check
```

This makes a few calls within the free allowance and prints the results without showing the keys. With `-- --embed` it also serves a test page at `http://localhost:3000/` showing the Maps Embed transit route (stop the dev server first, since it uses the same port).
