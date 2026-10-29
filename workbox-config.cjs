// Service worker for the static export. Runs after `next build` (see the
// build script) and precaches every file in out/, so the app and the plan
// pages open without signal.
module.exports = {
  globDirectory: "out",
  globPatterns: ["**/*.{html,js,css,json,png,svg,webmanifest}"],
  swDest: "out/sw.js",
  // The trip ID is in the query string (?trip=...). Ignore all query
  // parameters so every page matches its precached file.
  ignoreURLParametersMatching: [/.*/],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
};
