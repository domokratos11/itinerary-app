import { afterEach, describe, expect, it } from "vitest";
import { resolveCssColor, resolvePinColors } from "./css-color";

function setTokens(tokens: Record<string, string>) {
  for (const [name, value] of Object.entries(tokens))
    document.documentElement.style.setProperty(name, value);
}

afterEach(() => {
  document.documentElement.removeAttribute("style");
});

describe("resolveCssColor", () => {
  it("leaves real colours alone", () => {
    expect(resolveCssColor("#2563eb")).toBe("#2563eb");
    expect(resolveCssColor("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
  });

  it("reads the colour a token has on the page", () => {
    setTokens({ "--cat-food": "#c2740c" });
    expect(resolveCssColor("var(--cat-food)")).toBe("#c2740c");
  });

  it("follows a token that points at another token", () => {
    setTokens({ "--cat-sight": "#426dea", "--pin-stop": "var(--cat-sight)" });
    expect(resolveCssColor("var(--pin-stop)")).toBe("#426dea");
  });

  it("uses the fallback, or leaves the value, when the token is missing", () => {
    expect(resolveCssColor("var(--nope, #123456)")).toBe("#123456");
    expect(resolveCssColor("var(--nope)")).toBe("var(--nope)");
  });

  it("follows a change of colour family or theme", () => {
    setTokens({ "--pin-hotel": "#1d2228" });
    expect(resolveCssColor("var(--pin-hotel)")).toBe("#1d2228");
    setTokens({ "--pin-hotel": "#3f464e" });
    expect(resolveCssColor("var(--pin-hotel)")).toBe("#3f464e");
  });
});

describe("resolvePinColors", () => {
  it("resolves every pin's colour and keeps the rest", () => {
    setTokens({ "--pin-stop": "#426dea" });
    const pin = {
      id: "a",
      position: { lat: 1, lng: 2 },
      title: "A",
      label: "1",
      color: "var(--pin-stop)",
      emphasised: false,
      clickable: true,
    };
    expect(
      resolvePinColors([pin, { ...pin, id: "b", color: "#111111" }]),
    ).toEqual([
      { ...pin, color: "#426dea" },
      { ...pin, id: "b", color: "#111111" },
    ]);
  });
});
