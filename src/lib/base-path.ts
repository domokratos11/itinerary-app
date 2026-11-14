// The GitHub Pages sub-path. Must equal the GitHub repo name: Pages serves the
// site at https://domokratos11.github.io/itinerary-app/. next.config.ts and
// the scripts read it from here.
export const SITE_BASE_PATH = "/itinerary-app";

// The base path as the build set it (empty in tests). Use it for any URL the
// browser fetches directly (service worker, icons), since Next only adds the
// base path to links and routes.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
