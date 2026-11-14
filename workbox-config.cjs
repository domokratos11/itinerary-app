// Service worker for the static export. Runs after `next build` (see the
// build script) and precaches every file in out/, so the app and the plan
// pages open without signal. That includes the .txt route data: fetched from
// the network instead, it can come from a newer build than the cached page.
// version.json stays out, so it always tells the truth about what's deployed.
module.exports = {
  globDirectory: "out",
  globPatterns: ["**/*.{html,js,css,json,png,svg,ico,webmanifest,txt,woff2}"],
  globIgnores: ["version.json"],
  swDest: "out/sw.js",
  // The trip ID is in the query string (?trip=...). Ignore all query
  // parameters so every page matches its precached file.
  ignoreURLParametersMatching: [/.*/],
  // Workbox skips bigger files with only a warning. The phrasebook
  // (public/phrasebook/index.html, about 1.1 MB) grows with every topic and
  // must stay offline, so allow up to 5 MiB instead of the default 2 MiB.
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
};
