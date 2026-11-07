// Where the chosen language is remembered on this device, and the tiny
// script the root layout runs in <head> before the first paint, so the page
// carries the right `lang` from the start (screen readers pick their voice
// from it) instead of "en" until React loads. Same rule as initLocale in
// i18n.ts: the stored choice, else Spanish for an "es*" browser, else English.
export const LOCALE_STORAGE_KEY = "locale";

export const LANG_BOOT_SCRIPT = `(function(){var l;try{l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)})}catch(e){}if(l!=="en"&&l!=="es")l=/^es/i.test(navigator.language||"")?"es":"en";document.documentElement.lang=l})()`;
