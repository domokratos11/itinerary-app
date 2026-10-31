import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import type { NextConfig } from "next";

import { versionFromDescribe } from "./src/domain/version";

// Static export for GitHub Pages. Anything that needs a server
// (Server Actions, proxy, request-reading Route Handlers, ISR,
// default image optimization) is not allowed. See CLAUDE.md.
// Must equal the GitHub repo name: Pages serves it at
// https://domokratos11.github.io/itinerary-app/
const basePath = "/itinerary-app";

// From the latest v* tag on main; package.json only when there is none, as on
// a fresh clone or a branch without the tag.
function appVersion(): string {
  try {
    const described = execSync(
      'git describe --tags --first-parent --match "v*"',
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString();
    const version = versionFromDescribe(described);
    if (version) return version;
  } catch {
    // Not a git checkout, or no tag yet.
  }
  return JSON.parse(readFileSync("package.json", "utf8")).version;
}

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Read by client code (service worker, manifest links), which cannot see
  // the Next config object.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_APP_VERSION: appVersion(),
  },
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
