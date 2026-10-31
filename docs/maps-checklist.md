# Maps and research: what's left to do

M1 to M6 are written and committed on `develop`. Tests, validation and the build pass, and the Day and City pages were checked in a browser without keys. No real Google calls have been made, and the screens that need sign-in haven't been opened. Work through this in order, because the order matters.

The commands use Git Bash syntax. In PowerShell, run `$env:TRIP_ID="<id>"` first, then the command without the `TRIP_ID=<id>` part.

## 1. Check the code

- [x] Run `npm run test`, `npm run validate` and `npm run build`. All passed on Oct 30, 2026, with nothing to fix.
- [ ] Ask Claude to push `develop`. **Don't merge to `main` yet.**

## 2. Publish the Firestore rules

Do this **before** the merge. The new app writes new fields, and the current rules refuse them, so saves would fail.

- [ ] Paste `firestore.rules` into Firebase console > Firestore > Rules, then Publish.

## 3. Deploy

- [ ] Merge `develop` to `main`. Without keys the app works as before, plus the place editor, the Places tab and research. The map shows "The map isn't set up yet", and legs show straight-line distances.
- [ ] Open the app and edit a place, as a member. If the save is refused, step 2 didn't take effect. This is the first real test of the place editor, the Places tab and the research review, since they need sign-in.

## 4. Set up Google Cloud

You do this; it needs your card. Follow [maps-setup.md](maps-setup.md), about 20 minutes:

- [ ] Billing account and a $1 budget alert
- [ ] Two projects, `itinerary-maps-app` and `itinerary-maps-scripts`, neither of them the Firebase project
- [ ] APIs enabled in each
- [ ] Browser key and script key, with their restrictions
- [ ] Daily caps. **Tell Claude if a row has no per-day option**, since the app's only limit is then its own.
- [ ] Map ID
- [ ] Script and browser keys in `.env`

## 5. Test the keys and trains

- [ ] Run this and send Claude the output. It prints no keys.

```bash
npm run maps:check -- --embed
```

- [ ] Open `http://localhost:3000/` while it runs, and tell Claude whether the transit route shows. Stop the dev server first, since it uses the same port.

Claude records the result in the plan. If either test shows Japanese trains, it can replace the Train directions link. If neither does, nothing changes: that's what the plan assumes.

## 6. Add the browser key and logo

- [ ] Put the browser key and Map ID in `src/lib/maps.config.ts`.
- [ ] Download the attribution assets from the [Places policies page](https://developers.google.com/maps/documentation/places/web-service/policies). Copy the outlined Google Maps logo to `public/google-maps-logo.svg`. If there's no SVG, tell Claude. Until then the app shows the words "Google Maps", which Google allows only where a logo doesn't fit.
- [ ] Commit, push and merge, or ask Claude to.

## 7. Match the places

Run these once per computer if you haven't:

```bash
gcloud auth application-default login
```

- [ ] Try a few, then check their pins in the app:

```bash
TRIP_ID=<id> npm run maps:match -- --limit 5
```

- [ ] Run the rest:

```bash
TRIP_ID=<id> npm run maps:match
```

- [ ] Open `research/map-matches-<date>.json`, check each link, and set `"accept": true` on the right ones. Then:

```bash
TRIP_ID=<id> npm run maps:match -- --apply research/map-matches-<date>.json
```

## 8. Check the map

Claude can do these once the keys are in, except signing in, which is yours:

- [ ] Day and City pages at 390px and on desktop, in light and dark
- [ ] Pins are numbered, and tapping one opens Place details
- [ ] Offline shows the message, and the list still works
- [ ] Walking times between close stops, and Train directions on longer legs
- [ ] Live from Google and Show photo, with credits and the logo
- [ ] Hitting a cap shows the limit message

## 9. Run the research

Follow [research-run.md](research-run.md).

- [ ] Try 5 places, then review them under Settings > Places. Include Ueno Zoo: it should end up with a cost and duration, with sources, and nothing should change without your review.
- [ ] Run the rest, about 215 places, and review them. This uses your Claude plan.

## 10. Keep the coordinates fresh

Google allows its coordinates to be kept for 30 days. The script refreshes those over 20 days old, and deletes any over 30 that it can't refresh.

- [ ] Run it about every 3 weeks until you leave, starting 3 weeks after step 7:

```bash
TRIP_ID=<id> npm run maps:refresh
```

- [ ] Add **Dec 13** to your calendar, and use `--all` that day so everything is fresh when you leave:

```bash
TRIP_ID=<id> npm run maps:refresh -- --all
```

- [ ] Add **Jan 3** to your calendar and run the first command again during the trip. That keeps the coordinates inside the limit until you're home on Jan 12.

## Good to know

- **`npm run seed -- --force` now loses data.** It replaces places with the seed files, including place IDs, research, sources and locked fields. Don't use it after step 7.
- **Backups leave out Google's coordinates,** as they must. Run `maps:refresh` after restoring one.
- **A place name chosen from Google's suggestions is stored,** so Add place has something to call it. Google's terms don't clearly allow storing it. You can rename it in the same form, and research can correct it.
- **M7 wasn't built.** The Claude API script, the GitHub Action and station pins were optional.
