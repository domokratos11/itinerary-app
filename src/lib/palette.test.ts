import { beforeEach, describe, expect, it } from "vitest";

import { getPalette, setPalette } from "@/lib/palette";

describe("palette", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.palette;
  });

  it("is Sen until one is chosen", () => {
    expect(getPalette()).toBe("sen");
  });

  it("saves the choice and puts it on the page", () => {
    setPalette("pine");
    expect(getPalette()).toBe("pine");
    expect(localStorage.getItem("palette")).toBe("pine");
    expect(document.documentElement.dataset.palette).toBe("pine");
  });

  it("leaves no attribute for Sen", () => {
    setPalette("plum");
    setPalette("sen");
    expect(document.documentElement.dataset.palette).toBeUndefined();
    expect(getPalette()).toBe("sen");
  });

  it("ignores a saved value it doesn't know", () => {
    localStorage.setItem("palette", "neon");
    expect(getPalette()).toBe("sen");
  });
});
