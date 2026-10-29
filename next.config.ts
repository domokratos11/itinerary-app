import type { NextConfig } from "next";

// Static export for GitHub Pages. Anything that needs a server
// (Server Actions, proxy, request-reading Route Handlers, ISR,
// default image optimization) is not allowed. See CLAUDE.md.
// Must equal the GitHub repo name: Pages serves it at
// https://domokratos11.github.io/itinerary-app/
const basePath = "/itinerary-app";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Read by client code (service worker, manifest links), which cannot see
  // the Next config object.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
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
