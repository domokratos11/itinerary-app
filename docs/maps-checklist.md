# Maps and research: what's left to do

**Development of this stage is finished (Oct 31, 2026).** M1 to M6 are deployed, the real map is live, and the signed-in test passed. Steps 1 to 6 are done. Steps 7 to 10 are running the scripts and checking the results: the map has no pins until step 7 runs.

The commands use Git Bash syntax, which is the easiest place to run them. In PowerShell:

- Run `$env:TRIP_ID="<id>"` first, then the command without the `TRIP_ID=<id>` part.
- If it says `npm.ps1` or `gcloud.ps1` "cannot be loaded", use `npm.cmd` and `gcloud.cmd` instead.

## 1. Check the code

- [x] Run `npm run test`, `npm run validate` and `npm run build`. All passed on Oct 30, 2026, with nothing to fix.
- [x] Push `develop`.

## 2. Publish the Firestore rules

Do this **before** the merge. The new app writes new fields, and the current rules refuse them, so saves would fail.

- [x] Paste `firestore.rules` into Firebase console > Firestore > Rules, then Publish.

## 3. Deploy

- [x] Merge `develop` to `main`. Without keys the app works as before, plus the place editor, the Places tab and research. The map shows "The map isn't set up yet", and legs show straight-line distances.
- [x] Open the app and edit a place, as a member. If the save is refused, step 2 didn't take effect. This is the first real test of the place editor, the Places tab and the research review, since they need sign-in.

## 4. Set up Google Cloud

You do this; it needs your card. Follow [maps-setup.md](maps-setup.md), about 20 minutes:

- [x] Billing account and a $1 budget alert
- [x] Two projects, `itinerary-maps-app` and `itinerary-maps-scripts`, neither of them the Firebase project
- [x] APIs enabled in each
- [x] Browser key and script key, with their restrictions (tested: other sites and other APIs are refused)
- [ ] Daily caps: not confirmed, and not needed on the Free Trial, which ends Jan 29, 2027. **Set them before ever upgrading to a paid account.** Tell Claude if a row has no per-day option.
- [x] Map ID
- [x] Script and browser keys in `.env`

## 5. Test the keys and trains

- [x] Run this and send Claude the output. It prints no keys. Routes returned no train route; walking worked.

```bash
npm run maps:check -- --embed
```

- [x] Open `http://localhost:3000/` while it runs, and tell Claude whether the transit route shows. Stop the dev server first, since it uses the same port. It shows Japanese trains.

Claude records the result in the plan. If either test shows Japanese trains, it can replace the Train directions link. If neither does, nothing changes: that's what the plan assumes.

## 6. Add the browser key and logo

- [x] Put the browser key and Map ID in `src/lib/maps.config.ts`, as quoted strings.
- [x] Download the attribution assets from the [Places policies page](https://developers.google.com/maps/documentation/places/web-service/policies). Copy the outlined Google Maps logo to `public/google-maps-logo.svg`. If there's no SVG, tell Claude. Until then the app shows the words "Google Maps", which Google allows only where a logo doesn't fit.
- [x] Commit, push and merge, or ask Claude to.

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
- [ ] Add **Feb 3** to your calendar and run the first command one last time. The Free Trial ended on Jan 29, so it can't refresh anything and deletes the coordinates instead, as the 30-day limit requires. The place IDs stay. Use the date 31 days after your last refresh if it wasn't Jan 3.

## Good to know

- **`npm run seed -- --force` now loses data.** It replaces places with the seed files, including place IDs, research, sources and locked fields. Don't use it after step 7.
- **Backups leave out Google's coordinates,** as they must. Run `maps:refresh` after restoring one.
- **A place name chosen from Google's suggestions is stored,** so Add place has something to call it. Google's terms don't clearly allow storing it. You can rename it in the same form, and research can correct it.
- **`favicon.ico` must hold RGBA images,** or `npm run build` fails with "The PNG is not in RGBA format". Browsers don't mind, so only the build shows it.
- **The Free Trial ends Jan 29, 2027,** or sooner if the $300 credit runs out. After that the map and live details stop working and the rest of the app carries on. It can't be paused or extended.
- **M7 wasn't built.** The Claude API script, the GitHub Action and station pins were optional.
