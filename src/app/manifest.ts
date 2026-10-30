import type { MetadataRoute } from "next";

import { BASE_PATH } from "@/lib/base-path";

export const dynamic = "force-static";

// Lets both phones install the app to the home screen. start_url and scope
// include the GitHub Pages sub-path, which Next does not add here.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Japan Trip 2026–27",
    short_name: "Japan Trip",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    icons: [
      { src: `${BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
  };
}
