/* eslint-disable @typescript-eslint/no-require-imports */
// Serves the built site the way GitHub Pages does, under /itinerary-app/, so
// the production-only parts (service worker, version check) can be tried.
// Run `npm run build`, then `npm run preview`.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = 4173;
const BASE = "/itinerary-app";
const ROOT = path.resolve(__dirname, "..", "out");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function fileFor(urlPath) {
  const relative = decodeURIComponent(urlPath).slice(BASE.length);
  const full = path.join(ROOT, relative);
  if (!full.startsWith(ROOT)) return null;
  if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  const index = path.join(full, "index.html");
  return fs.existsSync(index) ? index : null;
}

http
  .createServer((request, response) => {
    const { pathname } = new URL(request.url, "http://localhost");
    const file = pathname.startsWith(BASE) ? fileFor(pathname) : null;
    if (!file) {
      response.writeHead(404, { "Content-Type": TYPES[".html"] });
      response.end(fs.readFileSync(path.join(ROOT, "404.html")));
      return;
    }
    response.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(file).pipe(response);
  })
  .listen(PORT, () => {
    console.log(`Serving out/ at http://localhost:${PORT}${BASE}/`);
  });
