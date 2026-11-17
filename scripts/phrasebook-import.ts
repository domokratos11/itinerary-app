/**
 * Copies the Japanese phrasebook (one self-contained HTML file made elsewhere)
 * into public/phrasebook-guide/index.html, precached by the service worker for
 * offline use. The app shows it at /phrasebook/ inside its own frame (an
 * iframe), and it also opens on its own as a fallback. Run
 * `npm run phrasebook:import`, or `npm run phrasebook:import -- <file>` for
 * a file somewhere other than ../phrasebook-src/japanese_guide.html.
 *
 * It adds a few marked blocks (the app's look, a link back to the app, the
 * manifest, the theme colour, the service worker and "show to staff") and
 * leaves every other byte alone.
 * Running it again, even on its own output, gives the same file.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_BASE_PATH } from "../src/lib/base-path";
import {
  PHRASEBOOK_FULLSCREEN_MESSAGE,
  PHRASEBOOK_GUIDE_PATH,
} from "../src/lib/phrasebook";
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

// Show to staff: tapping (or Enter on) any Japanese text (a card, an
// alternate or reply, a sign, a word-list entry, a dialogue line, the
// quiz's phrase) fills the screen with it in the largest type that fits,
// with the kana under it, the meaning small for the traveller, Listen and
// Close. It listens on the document, so the guide's own code is untouched,
// and makes each phrase focusable as it is rendered. Inside the app's frame
// it tells the page around it (PHRASEBOOK_FULLSCREEN_MESSAGE) so the frame
// covers the app's header and tab bar while it is open.
export const SHOW_TO_STAFF = `(function(){
var win=window,doc=document,MSG='${PHRASEBOOK_FULLSCREEN_MESSAGE}',PICK='.jp,.big,td.j';
var framed=!!win.parent&&win.parent!==win;
var canSpeak='speechSynthesis' in win&&'SpeechSynthesisUtterance' in win;
var box=null,fitBox,inner,jp,kana,mean,say,shut,back=null,hidden=[];
function tell(open){if(!framed)return;try{win.parent.postMessage({type:MSG,open:open},win.location.origin);}catch(e){}}
function pick(t){var el=t&&t.closest?t.closest(PICK):null;return el&&!el.closest('button,a,.tp-staff')?el:null;}
function child(scope,cls){if(!scope)return '';for(var i=0;i<scope.children.length;i++)if(scope.children[i].classList.contains(cls))return scope.children[i].textContent.trim();return '';}
function about(el){
var text=el.textContent.trim();
if(el.matches('td.j')){var row=el.parentNode,cell=row.cells&&row.cells[1],k=cell&&cell.querySelector('[lang="ja"]'),m=row.querySelector('.mean');return {jp:text,kana:k?k.textContent.trim():'',mean:m?m.textContent.trim():''};}
var scope=el.parentNode;if(el.classList.contains('big')&&scope&&scope.classList.contains('head'))scope=scope.parentNode;
return {jp:text,kana:child(scope,'kana'),mean:child(scope,'mean')};
}
function build(){
box=doc.createElement('div');box.className='tp-staff';box.hidden=true;
box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Phrase shown large');
box.innerHTML='<div class="tp-staff-fit"><div class="tp-staff-in"><div class="tp-staff-jp" lang="ja"></div><div class="tp-staff-kana" lang="ja"></div></div></div>'+
'<div class="tp-staff-mean"></div><div class="tp-staff-bar">'+
'<button type="button" class="tp-staff-say"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>Listen</button>'+
'<button type="button" class="tp-staff-close"><span aria-hidden="true">&#10005;</span>Close</button></div>';
fitBox=box.querySelector('.tp-staff-fit');inner=box.querySelector('.tp-staff-in');jp=box.querySelector('.tp-staff-jp');kana=box.querySelector('.tp-staff-kana');
mean=box.querySelector('.tp-staff-mean');say=box.querySelector('.tp-staff-say');shut=box.querySelector('.tp-staff-close');
box.addEventListener('click',function(e){if(e.target.closest('.tp-staff-say'))speak();else close();});
doc.body.appendChild(box);
}
function speak(){try{var s=win.speechSynthesis;s.cancel();var u=new win.SpeechSynthesisUtterance(jp.textContent);u.lang='ja-JP';u.rate=0.85;s.speak(u);}catch(e){}}
function fit(){
if(!box||box.hidden)return;
var w=fitBox.clientWidth,h=fitBox.clientHeight;if(!w||!h)return;
var lo=16,hi=Math.max(17,Math.min(w,h)+1);
while(hi-lo>1){var mid=(lo+hi)>>1;inner.style.fontSize=mid+'px';if(inner.scrollWidth<=w&&inner.scrollHeight<=h)lo=mid;else hi=mid;}
inner.style.fontSize=lo+'px';
}
function open(el){
if(!box)build();
var a=about(el);
jp.textContent=a.jp;kana.textContent=a.kana===a.jp?'':a.kana;kana.hidden=!kana.textContent;
mean.textContent=a.mean;mean.hidden=!a.mean;say.hidden=!canSpeak;
back=el;hidden=[];
for(var c=doc.body.firstElementChild;c;c=c.nextElementSibling)if(c!==box&&!c.hasAttribute('inert')){c.setAttribute('inert','');hidden.push(c);}
box.hidden=false;doc.documentElement.classList.add('tp-staff-on');
tell(true);fit();shut.focus();
}
function close(){
if(!box||box.hidden)return;
box.hidden=true;doc.documentElement.classList.remove('tp-staff-on');
for(var i=0;i<hidden.length;i++)hidden[i].removeAttribute('inert');hidden=[];
tell(false);
if(back&&back.isConnected)back.focus();back=null;
}
function mark(){var els=doc.querySelectorAll(PICK);for(var i=0;i<els.length;i++){var el=els[i];if(el.hasAttribute('tabindex')||!pick(el))continue;el.setAttribute('tabindex','0');if(el.tagName!=='TD')el.setAttribute('role','button');}}
doc.addEventListener('click',function(e){
if(box&&!box.hidden)return;
var sel=win.getSelection&&win.getSelection();if(sel&&!sel.isCollapsed&&String(sel).trim())return;
var el=pick(e.target);if(el)open(el);
});
doc.addEventListener('keydown',function(e){
if(box&&!box.hidden){
if(e.key==='Escape'){e.preventDefault();close();}
else if(e.key==='Tab'){var f=say.hidden?[shut]:[say,shut],i=f.indexOf(doc.activeElement);e.preventDefault();f[(i+(e.shiftKey?f.length-1:1))%f.length].focus();}
return;
}
var el=pick(e.target);if((e.key==='Enter'||e.key===' ')&&el){e.preventDefault();open(el);}
});
win.addEventListener('resize',fit);
win.addEventListener('pagehide',function(){if(box&&!box.hidden)tell(false);});
mark();
var main=doc.getElementById('main');
if(main&&win.MutationObserver)new win.MutationObserver(mark).observe(main,{childList:true,subtree:true});
})();`;

// Its look: the guide's own colours (light or dark, or the app's when
// framed), the largest Japanese that fits, and a hint on the home page.
export const SHOW_TO_STAFF_CSS =
  "\n.jp,.big,td.j{cursor:pointer}" +
  "\n.topic .jp{cursor:inherit}" +
  "\n[role=button].jp:focus-visible,[role=button].big:focus-visible,td.j[tabindex]:focus-visible{outline:2px solid var(--they);outline-offset:2px;border-radius:4px}" +
  '\n.lede::after{content:"Tap any Japanese text to show it large to staff.";display:block;margin-top:4px}' +
  "\nhtml.tp-staff-on,html.tp-staff-on body{overflow:hidden}" +
  "\n.tp-staff{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;gap:12px;background:var(--surface);color:var(--ink);" +
  "padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}" +
  "\n.tp-staff[hidden],.tp-staff [hidden]{display:none}" +
  "\n.tp-staff-fit{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}" +
  "\n.tp-staff-in{width:100%;text-align:center;font-family:var(--font-jp);line-height:1.25}" +
  // Japanese has no spaces: break at phrases where the browser can, never
  // before small kana or closing punctuation, and keep the lines even.
  "\n.tp-staff-jp{font-weight:800;word-break:normal;word-break:auto-phrase;line-break:strict;overflow-wrap:anywhere;text-wrap:balance}" +
  "\n.tp-staff-kana{font-size:max(16px,min(.3em,40px));font-weight:500;color:var(--muted);margin-top:.5em;line-break:strict;overflow-wrap:anywhere;text-wrap:balance}" +
  "\n.tp-staff-mean{font-size:14px;color:var(--muted);text-align:center}" +
  "\n.tp-staff-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}" +
  "\n.tp-staff-bar button{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 20px;border-radius:12px;font-size:16px;font-weight:700}" +
  "\n.tp-staff-bar svg{width:20px;height:20px}" +
  "\n.tp-staff-say{background:var(--chip);color:var(--ink)}" +
  "\n.tp-staff-close{background:var(--ink);color:var(--surface)}\n";

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
  {
    name: "</style>",
    anchor: /<\/style>/g,
    where: "before",
    markers: "css",
    content: SHOW_TO_STAFF_CSS,
  },
  {
    name: "</body>",
    anchor: /<\/body>/g,
    where: "before",
    content: `\n<script>${SHOW_TO_STAFF}</script>\n`,
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
