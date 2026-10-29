# Infographic design guide (Japan 2027)

Applies whenever `infographic_template.html` or `japan_2027_infographic.html` is changed. The page is checked mostly on a phone, so design for a 390px-wide screen first.

## Workflow rule
1. New or changed trip information goes into the city JSON files first (`01_` to `05_`).
2. Rebuild with `python3 build_infographic.py` (reads the JSONs and `infographic_template.html`, writes `japan_2027_infographic.html`).
3. Save the template (only if its design changed) and the rebuilt HTML back to this Project's `claude/` folder.

## Design decisions
- Subject: a winter trip, looked up on a phone while travelling. Primary job: find today's plan and tap through to maps.
- Colour: cool snow background in light mode, night-platform navy in dark mode, lantern yellow for Claude's suggestions and the "Today" button. Each city keeps its fixed line colour: Tokyo #d6336c, Nagoya #e8740c, Hiroshima #0f9d8a, Kobe #2f7fe0, Tokyo II #8d4fd8.
- The one memorable element is the route: a coloured line along the hero's bottom edge (segment length = nights) and a vertical station rail in the overview. Keep everything else quiet.
- Type: Japanese-capable system font stack (no web fonts, works offline). 16px body, tight heavy headings.
- Numbered stops are a real sequence (the walking order), so they use a numbered rail. Don't add numbering or eyebrow labels elsewhere.
- No all-caps labels, no gradient washes, no entrance animations.

## Mobile rules
- City tabs are a fixed bottom bar (thumb reach); a sticky top bar holds the travel mode and the Claude ideas toggle.
- Every tappable row is at least 44px tall; selects use 16px text so iOS does not zoom.
- Respect safe areas (`env(safe-area-inset-*)`), no horizontal scroll, dark mode follows the phone setting.
- On the overview, if the date is inside the trip, a "Today" button jumps to that day; before the trip it shows a countdown.
- After any change, screenshot at 390px wide (light and dark) and at 1280px wide before saving.

## Bonus nearby lists (added Oct 27)
- Every itinerary day except the flight days (Dec 15, Dec 16, Jan 12) has a `nearby` list of at least five ideas: museums, parks, shops, food, and some temples or shrines marked optional.
- The list is rendered as a closed "✨ Bonus nearby" row under the day, so it stays hidden until tapped.
- Entries are Claude suggestions from general knowledge, not live lookups. Their notes say to verify hours.
- Add or change them in the day's `nearby` array in the city JSON. Each item: name, category, area, kind (r = named place, q = map search), maps_query, notes, source, status.

## Directions links
- Mobile browsers accept at most three waypoints per directions link, so each link covers three stops and longer days show "Route part 1 of N", etc.
- Named places open as directions from the device location; "q" items open as map searches. Both use Google's documented Maps URL formats.
