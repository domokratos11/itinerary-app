// Service worker for the static export. Runs after `next build` (see the
// build script) and precaches every file in out/, so the app and the plan
// pages open without signal. That includes the .txt route data: fetched from
// the network instead, it can come from a newer build than the cached page.
// version.json stays out, so it always tells the truth about what's deployed.
module.exports = {
  globDirectory: "out",
  globPatterns: [
    "**/*.{html,js,css,json,png,svg,ico,webmanifest,txt,woff2}",
  ],
  globIgnores: ["version.json"],
  swDest: "out/sw.js",
  // The trip ID is in the query string (?trip=...). Ignore all query
  // parameters so every page matches its precached file.
  ignoreURLParametersMatching: [/.*/],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
};
