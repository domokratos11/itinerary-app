import { describe, expect, it } from "vitest";

import {
  applyFoodResult,
  builtInCategory,
  categorySearchUrl,
  FoodCategorySchema,
  foodCategories,
  foodPins,
  foodResearchRequests,
  foodSpotMapsUrl,
  moveCategory,
  newCustomCategory,
  requestCategoryResearch,
  spotFromDraft,
  type FoodSpot,
} from "./food";
import { fixtureTrip } from "@/test/fixture-trip";
import { sampleSpot } from "@/test/sample-food";

const now = new Date("2026-12-01T10:00:00.000Z");

function addedSpot(fields: Parameters<typeof sampleSpot>[0] = {}): FoodSpot {
  return applyFoodResult(
    [],
    foodCategories([]),
    { cityId: "nagoya", spots: [sampleSpot(fields)] },
    now,
  ).added[0];
}

describe("food categories", () => {
  it("has the built-in ones in order until someone changes them", () => {
    expect(foodCategories([]).map((c) => c.id)).toEqual([
      "specialty",
      "sushi",
      "kaiten-sushi",
      "ramen",
      "street-food",
      "cafe",
      "dessert",
    ]);
  });

  it("lets a saved row rename, move or archive a built-in one", () => {
    const ramen = { ...builtInCategory("ramen"), name: "Noodles", order: 0 };
    const sushi = { ...builtInCategory("sushi"), archived: true };
    const list = foodCategories([ramen, sushi]);
    expect(list[0]).toMatchObject({ id: "ramen", name: "Noodles" });
    expect(list.map((c) => c.id)).not.toContain("sushi");
    expect(foodCategories([sushi], { archived: true })).toHaveLength(7);
  });

  it("adds a custom one after the others with a free id", () => {
    const first = newCustomCategory("Izakaya", foodCategories([]), now);
    expect(first).toMatchObject({ id: "custom-izakaya", key: null, order: 7 });
    const second = newCustomCategory("Izakaya", [first], now);
    expect(second.id).toBe("custom-izakaya-2");
    expect(FoodCategorySchema.safeParse(first).success).toBe(true);
  });

  it("refuses a built-in category under another id", () => {
    const wrong = { ...builtInCategory("ramen"), id: "noodles" };
    expect(FoodCategorySchema.safeParse(wrong).success).toBe(false);
  });

  it("moves a category by swapping with its neighbour", () => {
    const list = foodCategories([]);
    const saved = moveCategory(list, "sushi", -1, now);
    expect(saved.map((c) => [c.id, c.order])).toEqual([
      ["sushi", 0],
      ["specialty", 1],
    ]);
    expect(moveCategory(list, "specialty", -1, now)).toEqual([]);
  });

  it("asks for research with a note", () => {
    const asked = requestCategoryResearch(
      builtInCategory("cafe"),
      " open on Jan 1 ",
      now,
    );
    expect(asked).toMatchObject({
      request: "open on Jan 1",
      requestedAt: now.toISOString(),
    });
  });
});

describe("links to Google Maps", () => {
  it("searches a spot, with its place when known", () => {
    expect(
      foodSpotMapsUrl({ mapsQuery: "Ajisai Hakodate", googlePlaceId: null }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=Ajisai%20Hakodate");
    expect(
      foodSpotMapsUrl({ mapsQuery: "Ajisai", googlePlaceId: "ChIJ123" }),
    ).toContain("&query_place_id=ChIJ123");
  });

  it("searches a category near the hotel, in English", () => {
    const url = categorySearchUrl(
      builtInCategory("kaitenSushi"),
      { name: "Tokyo (Ueno)" },
      { hotelName: "Sample Hotel" },
    );
    expect(decodeURIComponent(url)).toContain(
      "query=kaiten sushi near Sample Hotel, Tokyo Ueno, Japan",
    );
    const custom = newCustomCategory("Izakaya", [], now);
    expect(
      decodeURIComponent(categorySearchUrl(custom, { name: "Kobe" }, null)),
    ).toContain("query=Izakaya in Kobe, Japan");
  });
});

describe("research results", () => {
  it("adds new spots and skips those already in the city", () => {
    const first = addedSpot();
    expect(first).toMatchObject({
      id: "nagoya-sample-ramen-house",
      origin: "research",
      starred: false,
      googlePlaceId: null,
    });
    const report = applyFoodResult(
      [{ ...first, archived: true }],
      foodCategories([]),
      {
        cityId: "nagoya",
        spots: [
          sampleSpot({ name: "SAMPLE ramen house" }),
          sampleSpot({ name: "Other Place", categoryId: "nope" }),
          sampleSpot({ name: "Sweet Spot", categoryId: "dessert" }),
        ],
      },
      now,
    );
    expect(report.duplicates).toEqual(["SAMPLE ramen house"]);
    expect(report.unknownCategory).toEqual(["nope: Other Place"]);
    expect(report.added.map((s) => s.name)).toEqual(["Sweet Spot"]);
  });

  it("asks for cities and categories short of three spots, and requests", () => {
    const spots = ["A", "B", "C"].map((name) => ({
      ...addedSpot({ name }),
      id: `nagoya-${name.toLowerCase()}`,
    }));
    const cafe = requestCategoryResearch(builtInCategory("cafe"), "", now);
    const all = foodResearchRequests(
      {
        cities: fixtureTrip.cities,
        stays: fixtureTrip.stays,
        places: fixtureTrip.places,
        categories: [cafe],
        spots,
      },
      { requested: false },
    );
    const nagoya = all.find((r) => r.cityId === "nagoya")!;
    expect(nagoya.categories.map((c) => c.id)).not.toContain("ramen");
    expect(nagoya.categories.find((c) => c.id === "cafe")?.wanted).toBe(3);
    expect(nagoya.stays[0].hotelName).toBe("Sample Hotel Nagoya");
    expect(nagoya.existing).toHaveLength(3);

    const requested = foodResearchRequests(
      {
        cities: fixtureTrip.cities,
        stays: fixtureTrip.stays,
        places: [],
        categories: [cafe],
        spots,
      },
      { requested: true, only: "nagoya" },
    );
    expect(requested).toHaveLength(1);
    expect(requested[0].categories.map((c) => c.id)).toEqual(["cafe"]);
  });
});

describe("spots from the form", () => {
  const draft = {
    name: " My Café ",
    categoryId: "cafe",
    nameJa: "",
    area: "Osu",
    dish: "",
    description: "Good coffee",
    tip: "",
    priceLevel: 2,
    mapsQuery: "",
    websiteUrl: "",
  };

  it("searches the name, area and city when no search is given", () => {
    const spot = spotFromDraft(draft, "nagoya", "Nagoya", null, new Set(), now);
    expect(spot).toMatchObject({
      id: "nagoya-my-cafe",
      name: "My Café",
      mapsQuery: "My Café, Osu, Nagoya",
      origin: "member",
      nameJa: null,
    });
  });

  it("drops the Google fields when the search changes", () => {
    const placed: FoodSpot = {
      ...spotFromDraft(draft, "nagoya", "Nagoya", null, new Set(), now),
      googlePlaceId: "ChIJ1",
      lat: 35,
      lng: 136,
      locationSource: "google",
      locationFetchedAt: now.toISOString(),
    };
    const same = spotFromDraft(
      { ...draft, tip: "Busy" },
      "nagoya",
      "Nagoya",
      placed,
      new Set(),
      now,
    );
    expect(same.googlePlaceId).toBe("ChIJ1");
    const moved = spotFromDraft(
      { ...draft, mapsQuery: "Another place" },
      "nagoya",
      "Nagoya",
      placed,
      new Set(),
      now,
    );
    expect(moved).toMatchObject({ googlePlaceId: null, lat: null });
  });
});

describe("foodPins", () => {
  it("pins spots with coordinates and the hotel", () => {
    const spot = { ...addedSpot(), lat: 35.1, lng: 136.9, starred: true };
    const stay = { ...fixtureTrip.stays[1], lat: 35.17, lng: 136.88 };
    const pins = foodPins([spot, addedSpot({ name: "No coords" })], [stay]);
    expect(pins.map((p) => [p.id, p.label, p.emphasised])).toEqual([
      [`hotel-${stay.id}`, "H", true],
      [spot.id, null, true],
    ]);
  });
});
