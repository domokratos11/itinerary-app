import type { NextConfig } from "next";

// Static export for GitHub Pages. Anything that needs a server
// (Server Actions, proxy, request-reading Route Handlers, ISR,
// default image optimization) is not allowed. See CLAUDE.md.
const nextConfig: NextConfig = {
  output: "export",
  // Must equal the GitHub repo name: Pages serves it at
  // https://domokratos11.github.io/itinerary-app/
  basePath: "/itinerary-app",
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
