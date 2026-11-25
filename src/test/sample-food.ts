import type { FoodResultSpot } from "@/domain/food";

// Made-up food research for tests: names and links are invented.
export function sampleSpot(
  fields: Partial<FoodResultSpot> = {},
): FoodResultSpot {
  return {
    categoryId: "ramen",
    name: "Sample Ramen House",
    nameJa: "サンプルラーメン",
    area: "Station east side",
    near: "Sample Hotel Nagoya",
    dish: "Miso ramen",
    description: "A made-up ramen shop used in tests.",
    tip: "Closed Jan 1 to 3.",
    priceLevel: 1,
    mapsQuery: "Sample Ramen House Nagoya",
    websiteUrl: null,
    sources: ["https://example.com/ramen"],
    ...fields,
  };
}
