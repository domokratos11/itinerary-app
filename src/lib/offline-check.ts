import { BASE_PATH } from "@/lib/base-path";

// The pages the offline check looks for in the service worker's precache.
// Workbox keys each page by its index.html, so that is what is matched.
export const OFFLINE_PAGES = [
  "/",
  "/days/",
  "/day/",
  "/cities/",
  "/city/",
  "/budget/",
  "/misc/",
  "/todos/",
  "/settings/",
  "/phrasebook/",
  "/phrasebook-guide/",
  "/kanji/",
  "/city-notes/",
] as const;

export type PrecacheStatus = {
  // Whether a service worker controls this page at all.
  worker: boolean;
  cached: number;
  total: number;
};

export async function precacheStatus(
  pages: readonly string[] = OFFLINE_PAGES,
): Promise<PrecacheStatus> {
  const total = pages.length;
  try {
    const worker = !!navigator.serviceWorker?.controller;
    const found = await Promise.all(
      pages.map((page) =>
        caches.match(`${BASE_PATH}${page}index.html`, { ignoreSearch: true }),
      ),
    );
    return { worker, cached: found.filter(Boolean).length, total };
  } catch {
    // No Cache Storage here (a private window, or an old browser).
    return { worker: false, cached: 0, total };
  }
}

// Asks the service worker to fetch a newer build if there is one. It installs
// in the background; the version check then moves the app over to it.
export async function updateServiceWorker(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration(
      `${BASE_PATH}/`,
    );
    await registration?.update();
  } catch {
    // Offline, or no worker: the next visit tries again.
  }
}
