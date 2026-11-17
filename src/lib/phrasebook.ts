// Where scripts/phrasebook-import.ts puts the static phrasebook (under
// public/), relative to the base path. The app shows it at /phrasebook/
// inside its own frame; this static copy also opens on its own, which is
// the fallback when the app itself can't open offline.
export const PHRASEBOOK_GUIDE_PATH = "/phrasebook-guide/";

// What the guide tells the app around it while it shows a phrase full screen
// for staff (scripts/phrasebook-import.ts, SHOW_TO_STAFF): `{ type, open }`,
// posted to the same origin. The app then lets its frame cover the whole
// screen, header and tab bar included, until `open` is false again.
export const PHRASEBOOK_FULLSCREEN_MESSAGE =
  "trip-planner:phrasebook-fullscreen";
