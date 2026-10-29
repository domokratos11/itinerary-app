import { describe, expect, it } from "vitest";

import { PlaceSchema } from "../src/domain/schemas";
import { buildMapsUrl, categoryFor, priorityFor, toPlace } from "./migrate-v3";

describe("categoryFor", () => {
  it("maps V3 categories onto the app's six categories", () => {
    expect(categoryFor("food-market")).toBe("food");
    expect(categoryFor("mall")).toBe("shopping");
    expect(categoryFor("day-trip")).toBe("daytrip");
    expect(categoryFor("shrine")).toBe("temple");
    expect(categoryFor("museum")).toBe("sight");
  });

  it("falls back to sight for unknown or missing categories", () => {
    expect(categoryFor("something-new")).toBe("sight");
    expect(categoryFor(undefined)).toBe("sight");
  });

  it("puts winter illuminations under lights", () => {
    expect(categoryFor("sightseeing", true)).toBe("lights");
  });
});

describe("priorityFor", () => {
  it("maps V3 status onto must, want or maybe", () => {
    expect(priorityFor("planned")).toBe("must");
    expect(priorityFor("suggested")).toBe("want");
    expect(priorityFor("optional")).toBe("maybe");
    expect(priorityFor("unavailable")).toBe("maybe");
  });
});

describe("buildMapsUrl", () => {
  it("builds a plain Google Maps search link with no API key", () => {
    expect(buildMapsUrl("Ueno Zoo Japan")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Ueno%20Zoo%20Japan",
    );
  });
});

describe("toPlace", () => {
  it("produces a valid Place with lowercase id and no coordinates", () => {
    const place = toPlace(
      {
        id: "t1-mAAch-ecute",
        name: "Ecute Ueno",
        category: "shopping",
        area: "Ueno",
        status: "planned",
        source_url: "https://www.example.com/ecute",
        notes: "Station shopping.",
        tags: ["station"],
      },
      { cityId: "tokyo-ueno", cityName: "Tokyo Ueno" },
    );

    expect(place.id).toBe("t1-maach-ecute");
    expect(place.lat).toBeNull();
    expect(place.priority).toBe("must");
    expect(place.websiteUrl).toBe("https://www.example.com/ecute");
    expect(place.notes).toContain("Tags: station.");
    expect(PlaceSchema.safeParse(place).success).toBe(true);
  });

  it("drops a Google Maps source_url into mapsUrl instead of websiteUrl", () => {
    const place = toPlace(
      {
        id: "x-1",
        name: "Test",
        source_url: "https://maps.app.goo.gl/abc",
      },
      { cityId: "osaka", cityName: "Osaka" },
    );
    expect(place.websiteUrl).toBeNull();
  });
});
