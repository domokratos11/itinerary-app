// Where scripts/phrasebook-import.ts puts the static phrasebook (under
// public/), relative to the base path. The app shows it at /phrasebook/
// inside its own frame; this static copy also opens on its own, which is
// the fallback when the app itself can't open offline.
export const PHRASEBOOK_GUIDE_PATH = "/phrasebook-guide/";
