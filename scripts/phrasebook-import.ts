/**
 * Copies the Japanese phrasebook (one self-contained HTML file made elsewhere)
 * into public/phrasebook/index.html, so it is served at /phrasebook/ and
 * precached by the service worker for offline use. Run
 * `npm run phrasebook:import`, or `npm run phrasebook:import -- <file>` for
 * a file somewhere other than ../phrasebook-src/japanese_guide.html.
 *
 * It adds a few marked blocks (a link back to the app, the manifest, the
 * theme colour and the service worker) and leaves every other byte alone.
 * Running it again, even on its own output, gives the same file.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_BASE_PATH } from "../src/lib/base-path";
import { THEME_COLOR } from "../src/lib/theme-color";

// Every block is wrapped in markers so a later import can find and replace
// it. Inside <style> they must be CSS comments: an HTML comment there is CSS
// text and would swallow the rule after it.
const MARKERS = {
  html: ["<!-- trip-planner:start -->", "<!-- trip-planner:end -->"],
  css: ["/* trip-planner:start */", "/* trip-planner:end */"],
} as const;
const BLOCK =
  /(?:<!-- trip-planner:start -->[\s\S]*?<!-- trip-planner:end -->|\/\* trip-planner:start \*\/[\s\S]*?\/\* trip-planner:end \*\/)/g;

// Where each block goes. Each anchor must appear exactly once: if the guide's
// template changes, the import stops rather than guessing.
const INJECTIONS: {
  name: string;
  anchor: RegExp;
  where: "after" | "before";
  content: string;
  markers?: keyof typeof MARKERS;
}[] = [
  {
    name: "viewport meta",
    anchor: /<meta name="viewport"[^>]*>/g,
    where: "after",
    content:
      `\n<link rel="manifest" href="${SITE_BASE_PATH}/manifest.webmanifest">` +
      `\n<meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLOR.light}">` +
      `\n<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLOR.dark}">` +
      `\n<meta name="apple-mobile-web-app-capable" content="yes">\n`,
  },
  {
    name: "</style>",
    anchor: /<\/style>/g,
    where: "before",
    markers: "css",
    content:
      "\n.trip-home{display:inline-flex;align-self:flex-start;align-items:center;min-height:44px;padding:0 4px;" +
      "color:var(--muted);font-size:14px;font-weight:600;text-decoration:none}" +
      "\n.trip-home:hover,.trip-home:focus-visible{color:var(--ink)}\n",
  },
  {
    name: '<div class="top-in">',
    anchor: /<div class="top-in">/g,
    where: "after",
    content: `<a class="trip-home" href="${SITE_BASE_PATH}/">&#8592; Trip Planner</a>`,
  },
  {
    name: "</body>",
    anchor: /<\/body>/g,
    where: "before",
    content:
      "\n<script>if('serviceWorker' in navigator)navigator.serviceWorker" +
      `.register('${SITE_BASE_PATH}/sw.js',{scope:'${SITE_BASE_PATH}/'}).catch(function(){});</script>\n`,
  },
];

// The guide as it was before any import.
export function stripPhrasebook(html: string): string {
  return html.replace(BLOCK, "");
}

export function importPhrasebook(source: string): string {
  let html = stripPhrasebook(source);
  for (const { name, anchor, where, content, markers } of INJECTIONS) {
    const [start, end] = MARKERS[markers ?? "html"];
    const matches = [...html.matchAll(anchor)];
    if (matches.length !== 1)
      throw new Error(
        `Phrasebook import: expected the anchor ${name} exactly once, found it ${matches.length} times. The guide's template has changed; update scripts/phrasebook-import.ts.`,
      );
    const match = matches[0];
    const at = where === "after" ? match.index + match[0].length : match.index;
    html = html.slice(0, at) + start + content + end + html.slice(at);
  }
  return html;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_SOURCE = path.resolve(
  ROOT,
  "..",
  "phrasebook-src",
  "japanese_guide.html",
);
const OUTPUT = path.join(ROOT, "public", "phrasebook", "index.html");

function main() {
  const source = path.resolve(process.argv[2] ?? DEFAULT_SOURCE);
  const html = importPhrasebook(readFileSync(source, "utf8"));
  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, html, "utf8");
  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)} (${kb} KB) from ${source}`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
