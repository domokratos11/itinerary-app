import { afterEach, describe, expect, it, vi } from "vitest";

import { LANG_BOOT_SCRIPT, LOCALE_STORAGE_KEY } from "./lang-boot";

function boot() {
  document.documentElement.lang = "en";
  new Function(LANG_BOOT_SCRIPT)();
  return document.documentElement.lang;
}

describe("LANG_BOOT_SCRIPT", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses the language chosen on this device", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "es");
    expect(boot()).toBe("es");
  });

  it("falls back to a Spanish browser's language", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("es-MX");
    expect(boot()).toBe("es");
  });

  it("defaults to English", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("ja-JP");
    expect(boot()).toBe("en");
  });

  it("ignores a stored value that isn't a language", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "xx");
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    expect(boot()).toBe("en");
  });
});
