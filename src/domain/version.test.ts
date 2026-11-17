import { describe, expect, it } from "vitest";

import { sameRelease, versionFromDescribe } from "@/domain/version";

describe("versionFromDescribe", () => {
  it("is the tag itself on the tagged commit", () => {
    expect(versionFromDescribe("v1.0.0\n")).toBe("1.0.0");
  });

  it("adds the commits since the tag to the last number", () => {
    expect(versionFromDescribe("v1.0.0-3-gabc1234")).toBe("1.0.3");
    expect(versionFromDescribe("v1.2.5-10-gabc1234")).toBe("1.2.15");
  });

  it("gives up on anything else", () => {
    expect(versionFromDescribe("abc1234")).toBeNull();
    expect(versionFromDescribe("release-1")).toBeNull();
    expect(versionFromDescribe("")).toBeNull();
  });
});

describe("sameRelease", () => {
  it("is true when only the last number differs", () => {
    expect(sameRelease("1.0.20", "1.0.21")).toBe(true);
    expect(sameRelease("1.0.21", "1.0.20")).toBe(true);
  });

  it("is false for a new major or minor version, or one it can't read", () => {
    expect(sameRelease("1.0.20", "1.1.0")).toBe(false);
    expect(sameRelease("1.9.3", "2.0.0")).toBe(false);
    expect(sameRelease("dev", "1.0.0")).toBe(false);
    expect(sameRelease("", "1.0.0")).toBe(false);
  });
});
