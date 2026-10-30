# itinerary-app

A personal itinerary app for our Japan trip (Dec 2026 – Jan 2027), built with Next.js + shadcn/ui and published as a static site on GitHub Pages:
https://domokratos11.github.io/itinerary-app/

```bash
npm install
npm run dev        # http://localhost:3000/itinerary-app/
npm run test
npm run validate
npm run build      # static export in out/
```

Project rules for Claude Code are in [CLAUDE.md](CLAUDE.md).

## After changing firestore.rules

The app reads and writes the trip in Firestore. When `firestore.rules`
changes, paste it into Firebase console → Firestore → Rules and Publish;
until then, edits to the new parts (settings, queue edits, activity) are
refused, and the app keeps showing the bundled `data/` files.

To copy `data/` into a trip right away (optional: the first edit in
Settings copies it too):

```bash
TRIP_ID=<your trip id> npm run seed
```

The trip ID stays out of the repo; it lives only in the shared link.
