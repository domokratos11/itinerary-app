/**
 * Copies the Japanese phrasebook (one self-contained HTML file made elsewhere)
 * into public/phrasebook-guide/index.html, precached by the service worker for
 * offline use. The app shows it at /phrasebook/ inside its own frame (an
 * iframe), and it also opens on its own as a fallback. Run
 * `npm run phrasebook:import`, or `npm run phrasebook:import -- <file>` for
 * a file somewhere other than ../phrasebook-src/japanese_guide.html.
 *
 * It adds a few marked blocks (the app's look, a link back to the app, the
 * manifest, the theme colour and the service worker) and leaves every other
 * byte alone.
 * Running it again, even on its own output, gives the same file.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_BASE_PATH } from "../src/lib/base-path";
import { PHRASEBOOK_GUIDE_PATH } from "../src/lib/phrasebook";
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

// Gives the guide the app's look. Inside the app's frame it copies the app's
// colours (its palette, light or dark), its fonts and their @font-face rules
// from the page around it, and follows them when they change. On its own it
// only takes the light or dark choice saved by the app. The guide's own
// colours for "they say" and "you say" stay, switched by data-theme.
export const THEME_SYNC = `(function(){
var root=document.documentElement,host=null,win=null;
try{if(window.top!==window.self){win=window.parent;host=win.document.documentElement;root.classList.add('in-app');}}catch(e){host=null;}
var VARS={'--bg':'--background','--surface':'--card','--ink':'--foreground','--muted':'--muted-foreground','--line':'--border','--chip':'--muted','--accent':'--primary','--app-display':'--font-display'};
function own(){var t=null;try{t=localStorage.getItem('theme');}catch(e){}if(t==='light'||t==='dark')root.setAttribute('data-theme',t);}
function sync(){
if(!host){own();return;}
root.setAttribute('data-theme',host.classList.contains('dark')?'dark':'light');
var cs=win.getComputedStyle(host);
for(var k in VARS){var v=cs.getPropertyValue(VARS[k]).trim();if(v)root.style.setProperty(k,v);}
var f=win.getComputedStyle(win.document.body).fontFamily;if(f)root.style.setProperty('--font-body',f);
}
function fonts(){
if(!host)return;
var css='',sheets=win.document.styleSheets;
for(var i=0;i<sheets.length;i++){var r;try{r=sheets[i].cssRules;}catch(e){continue;}for(var j=0;j<r.length;j++)if(r[j].type===5)css+=r[j].cssText+'\\n';}
if(css){var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}
}
sync();fonts();
if(host&&window.MutationObserver)new MutationObserver(sync).observe(host,{attributes:true,attributeFilter:['class','data-palette','style']});
window.addEventListener('storage',function(e){if(!host&&e.key==='theme')own();});
})();`;

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
      `\n<meta name="apple-mobile-web-app-capable" content="yes">` +
      `\n<script>${THEME_SYNC}</script>\n`,
  },
  {
    name: "</style>",
    anchor: /<\/style>/g,
    where: "before",
    markers: "css",
    content:
      "\n.trip-home{display:inline-flex;align-self:flex-start;align-items:center;min-height:44px;padding:0 4px;" +
      "color:var(--muted);font-size:14px;font-weight:600;text-decoration:none}" +
      "\n.trip-home:hover,.trip-home:focus-visible{color:var(--ink)}" +
      // Inside the app, its own header and tab bar lead back.
      "\nhtml.in-app .trip-home{display:none}" +
      "\nhtml.in-app .title b{font-family:var(--app-display),var(--font-body)}\n",
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
const OUTPUT = path.join(ROOT, "public", PHRASEBOOK_GUIDE_PATH, "index.html");

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
