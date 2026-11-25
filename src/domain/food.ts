import { z } from "zod";

import type { MapPin } from "./maps-service";
import { placePoint } from "./map-pins";
import { mapFields, type CityRecord, type StayRecord } from "./schemas";
import { CATEGORY_COLOR } from "./taxonomy";

// Where to eat in each of the trip's cities, by category: researched spots
// (docs/food-research.md) and the members' own. Every spot opens on Google
// Maps; with a place ID it also gets a pin. No hours, ratings or photos from
// Google are kept, and coordinates from Google follow the 30-day limit
// (maps:match, maps:refresh). Research text is in English only.

const recordId = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(64);
const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

// The built-in categories, in the order shown. Their names come from the
// messages files unless a member renames one.
export const FOOD_CATEGORY_KEYS = [
  "specialty",
  "sushi",
  "kaitenSushi",
  "ramen",
  "streetFood",
  "cafe",
  "dessert",
] as const;
export type FoodCategoryKey = (typeof FOOD_CATEGORY_KEYS)[number];

const BUILT_IN_IDS: Record<FoodCategoryKey, string> = {
  specialty: "specialty",
  sushi: "sushi",
  kaitenSushi: "kaiten-sushi",
  ramen: "ramen",
  streetFood: "street-food",
  cafe: "cafe",
  dessert: "dessert",
};

// The English search words for a built-in category on Google Maps, which
// stays in English (rule 13).
const SEARCH_WORDS: Record<FoodCategoryKey, string> = {
  specialty: "local specialty restaurant",
  sushi: "sushi",
  kaitenSushi: "kaiten sushi",
  ramen: "ramen",
  streetFood: "street food",
  cafe: "cafe",
  dessert: "dessert",
};

export const FOOD_PRICE_LEVELS = [1, 2, 3, 4] as const;
export const FOOD_SPOT_ORIGINS = ["research", "member"] as const;

// trips/{tripId}/foodCategories/{id}: one for the whole trip. A built-in
// category needs no document until someone renames, moves, archives or asks
// research about it.
export const FoodCategorySchema = z
  .object({
    id: recordId,
    key: z.enum(FOOD_CATEGORY_KEYS).nullable(),
    // A custom category's name, or a built-in one's new name.
    name: z.string().trim().min(1).max(60).nullable(),
    order: z.number().int().min(0).max(999),
    // An open research request, with an optional note for the researcher.
    request: z.string().max(1000).nullable(),
    requestedAt: z.iso.datetime().nullable(),
    archived: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .refine((c) => c.key !== null || c.name !== null, "needs a name")
  .refine(
    (c) => c.key === null || c.id === BUILT_IN_IDS[c.key],
    "a built-in category keeps its id",
  );
export type FoodCategory = z.infer<typeof FoodCategorySchema>;

// trips/{tripId}/foodSpots/{id}.
export const FoodSpotSchema = z
  .object({
    id: recordId,
    cityId: recordId,
    categoryId: recordId,
    name: z.string().trim().min(1).max(120),
    nameJa: z.string().trim().min(1).max(80).nullable(),
    // The neighbourhood, or the day-trip town it's in.
    area: z.string().trim().max(120).nullable(),
    // The hotel or planned place it's close to.
    near: z.string().trim().max(120).nullable(),
    // What to order there.
    dish: z.string().trim().max(120).nullable(),
    description: z.string().max(600),
    tip: z.string().max(300).nullable(),
    priceLevel: z.number().int().min(1).max(4).nullable(),
    // What to search on Google Maps to find it.
    mapsQuery: z.string().trim().min(1).max(200),
    websiteUrl: httpsUrl.nullable(),
    sources: z.array(httpsUrl).max(10),
    origin: z.enum(FOOD_SPOT_ORIGINS),
    starred: z.boolean(),
    lat: z.number().min(-90).max(90).nullable().default(null),
    lng: z.number().min(-180).max(180).nullable().default(null),
    ...mapFields,
    archived: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type FoodSpot = z.infer<typeof FoodSpotSchema>;

export interface FoodRepository {
  subscribeCategories(
    tripId: string,
    onRows: (rows: FoodCategory[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  subscribeSpots(
    tripId: string,
    onRows: (rows: FoodSpot[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  saveCategory(tripId: string, row: FoodCategory): Promise<void>;
  saveSpot(tripId: string, row: FoodSpot): Promise<void>;
}

// A built-in category as it is before anyone changed it.
export function builtInCategory(key: FoodCategoryKey): FoodCategory {
  return {
    id: BUILT_IN_IDS[key],
    key,
    name: null,
    order: FOOD_CATEGORY_KEYS.indexOf(key),
    request: null,
    requestedAt: null,
    archived: false,
    // Never shown or saved as is: a save stamps its own time.
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// Every category, built-in ones included, saved changes winning, in order.
// Archived ones are left out unless asked for.
export function foodCategories(
  rows: FoodCategory[],
  { archived = false }: { archived?: boolean } = {},
): FoodCategory[] {
  const byId = new Map(
    FOOD_CATEGORY_KEYS.map((key) => {
      const row = builtInCategory(key);
      return [row.id, row];
    }),
  );
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()]
    .filter((c) => archived || !c.archived)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

// The name shown: a saved name, or the built-in one in the person's language.
export function categoryLabel(
  category: FoodCategory,
  builtInName: (key: FoodCategoryKey) => string,
): string {
  return category.name ?? (category.key ? builtInName(category.key) : "");
}

// A new custom category, after the others.
export function newCustomCategory(
  name: string,
  existing: FoodCategory[],
  now: Date,
): FoodCategory {
  const base = slug(name) || "category";
  const taken = new Set(existing.map((c) => c.id));
  let id = `custom-${base}`.slice(0, 64);
  for (let n = 2; taken.has(id); n += 1)
    id = `custom-${base}`.slice(0, 60) + `-${n}`;
  const last = Math.max(-1, ...existing.map((c) => c.order));
  return {
    id,
    key: null,
    name: name.trim().slice(0, 60),
    order: Math.min(999, last + 1),
    request: null,
    requestedAt: null,
    archived: false,
    updatedAt: now.toISOString(),
  };
}

// Swaps a category with its neighbour above (-1) or below (+1). Returns the
// rows to save; none when it is already at that end.
export function moveCategory(
  categories: FoodCategory[],
  id: string,
  direction: -1 | 1,
  now: Date,
): FoodCategory[] {
  const index = categories.findIndex((c) => c.id === id);
  const other = categories[index + direction];
  if (index < 0 || !other) return [];
  // Renumber everything so equal orders can't get stuck.
  const ordered = categories.map((c) => c.id);
  [ordered[index], ordered[index + direction]] = [
    ordered[index + direction],
    ordered[index],
  ];
  const stamp = now.toISOString();
  return ordered.flatMap((cid, order) => {
    const row = categories.find((c) => c.id === cid)!;
    return row.order === order ? [] : [{ ...row, order, updatedAt: stamp }];
  });
}

export function requestCategoryResearch(
  category: FoodCategory,
  message: string,
  now: Date,
): FoodCategory {
  const stamp = now.toISOString();
  return {
    ...category,
    request: message.trim().slice(0, 1000),
    requestedAt: stamp,
    updatedAt: stamp,
  };
}

export function cancelCategoryResearch(
  category: FoodCategory,
  now: Date,
): FoodCategory {
  return {
    ...category,
    request: null,
    requestedAt: null,
    updatedAt: now.toISOString(),
  };
}

export const isResearchRequested = (c: FoodCategory) => c.requestedAt !== null;

// The spot on Google Maps: its place when the ID is known, otherwise a
// search for its name and area.
export function foodSpotMapsUrl(spot: {
  mapsQuery: string;
  googlePlaceId: string | null;
}): string {
  const query = encodeURIComponent(spot.mapsQuery);
  const id = spot.googlePlaceId
    ? `&query_place_id=${encodeURIComponent(spot.googlePlaceId)}`
    : "";
  return `https://www.google.com/maps/search/?api=1&query=${query}${id}`;
}

// A general Google Maps search for a category around where you sleep, such
// as "ramen near Dukes Hotel Hakata, Fukuoka".
export function categorySearchUrl(
  category: FoodCategory,
  city: Pick<CityRecord, "name">,
  stay: Pick<StayRecord, "hotelName"> | null,
): string {
  const words = category.key
    ? SEARCH_WORDS[category.key]
    : (category.name ?? "");
  const place = cleanCityName(city.name);
  const near =
    stay && !isUndecidedHotel(stay.hotelName)
      ? `${words} near ${stay.hotelName}, ${place}`
      : `${words} in ${place}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${near}, Japan`)}`;
}

// "Tokyo (Ueno)" searches as "Tokyo Ueno".
function cleanCityName(name: string): string {
  return name.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

const isUndecidedHotel = (name: string) =>
  name.toLowerCase().startsWith("to be decided");

// The city's live stays, first one first.
export function cityStays(stays: StayRecord[], cityId: string): StayRecord[] {
  return stays
    .filter((s) => !s.archived && s.cityId === cityId)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

// A city's live spots, starred first, then by name.
export function citySpots(spots: FoodSpot[], cityId: string): FoodSpot[] {
  return spots
    .filter((s) => !s.archived && s.cityId === cityId)
    .sort(
      (a, b) =>
        Number(b.starred) - Number(a.starred) || a.name.localeCompare(b.name),
    );
}

// Spots grouped under their categories, in the categories' order. A spot
// whose category was archived is left out with it.
export function spotsByCategory(
  spots: FoodSpot[],
  categories: FoodCategory[],
): { category: FoodCategory; spots: FoodSpot[] }[] {
  return categories.map((category) => ({
    category,
    spots: spots.filter((s) => s.categoryId === category.id),
  }));
}

const SPOT_COLOR = CATEGORY_COLOR.food;
const HOTEL_COLOR = "var(--pin-hotel)";

// The spots with coordinates as pins, starred ones larger, and the city's
// hotels marked H.
export function foodPins(spots: FoodSpot[], stays: StayRecord[]): MapPin[] {
  const hotels = stays.flatMap((stay) => {
    const position = placePoint(stay);
    if (!position) return [];
    return [
      {
        id: `hotel-${stay.id}`,
        position,
        title: stay.hotelName,
        label: "H",
        color: HOTEL_COLOR,
        emphasised: true,
        clickable: false,
      },
    ];
  });
  const food = spots.flatMap((spot) => {
    const position = placePoint(spot);
    if (!position) return [];
    return [
      {
        id: spot.id,
        position,
        title: spot.name,
        label: null,
        color: SPOT_COLOR,
        emphasised: spot.starred,
        clickable: true,
      },
    ];
  });
  return [...hotels, ...food];
}

export function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

// What a member types in the spot form.
export type FoodSpotDraft = {
  name: string;
  categoryId: string;
  nameJa: string;
  area: string;
  dish: string;
  description: string;
  tip: string;
  priceLevel: number | null;
  mapsQuery: string;
  websiteUrl: string;
};

const orNull = (text: string) => (text.trim() === "" ? null : text.trim());

// A new spot from the form, or the edited one. The Google fields stay with
// the spot unless its search changed, since they may no longer match.
export function spotFromDraft(
  draft: FoodSpotDraft,
  cityId: string,
  cityName: string,
  existing: FoodSpot | null,
  taken: ReadonlySet<string>,
  now: Date,
): FoodSpot {
  const name = draft.name.trim();
  const area = orNull(draft.area);
  const mapsQuery =
    orNull(draft.mapsQuery) ??
    [name, area, cleanCityName(cityName)].filter(Boolean).join(", ");
  const sameSearch = existing?.mapsQuery === mapsQuery;
  const google =
    existing && sameSearch
      ? {
          lat: existing.lat,
          lng: existing.lng,
          googlePlaceId: existing.googlePlaceId,
          locationFetchedAt: existing.locationFetchedAt,
          locationSource: existing.locationSource,
        }
      : {
          lat: null,
          lng: null,
          googlePlaceId: null,
          locationFetchedAt: null,
          locationSource: null,
        };
  return FoodSpotSchema.parse({
    id: existing?.id ?? spotId(cityId, name, taken),
    cityId,
    categoryId: draft.categoryId,
    name,
    nameJa: orNull(draft.nameJa),
    area,
    near: existing?.near ?? null,
    dish: orNull(draft.dish),
    description: draft.description.trim(),
    tip: orNull(draft.tip),
    priceLevel: draft.priceLevel,
    mapsQuery: mapsQuery.slice(0, 200),
    websiteUrl: orNull(draft.websiteUrl),
    sources: existing?.sources ?? [],
    origin: existing?.origin ?? "member",
    starred: existing?.starred ?? false,
    ...google,
    archived: false,
    updatedAt: now.toISOString(),
  });
}

export function draftFromSpot(spot: FoodSpot): FoodSpotDraft {
  return {
    name: spot.name,
    categoryId: spot.categoryId,
    nameJa: spot.nameJa ?? "",
    area: spot.area ?? "",
    dish: spot.dish ?? "",
    description: spot.description,
    tip: spot.tip ?? "",
    priceLevel: spot.priceLevel,
    mapsQuery: spot.mapsQuery,
    websiteUrl: spot.websiteUrl ?? "",
  };
}

// An id from the city and the name, unique among those taken.
export function spotId(
  cityId: string,
  name: string,
  taken: ReadonlySet<string>,
): string {
  const base = `${cityId}-${slug(name) || "spot"}`.slice(0, 60);
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

const sameName = (a: string, b: string) => slug(a) === slug(b);

// --- Research -------------------------------------------------------------

// One spot as the researcher writes it.
export const FoodResultSpotSchema = z
  .object({
    categoryId: recordId,
    name: z.string().trim().min(1).max(120),
    nameJa: z.string().trim().min(1).max(80).nullable(),
    area: z.string().trim().max(120).nullable(),
    near: z.string().trim().max(120).nullable(),
    dish: z.string().trim().max(120).nullable(),
    description: z.string().trim().min(1).max(600),
    tip: z.string().trim().max(300).nullable(),
    priceLevel: z.number().int().min(1).max(4).nullable(),
    mapsQuery: z.string().trim().min(1).max(200),
    websiteUrl: httpsUrl.nullable(),
    sources: z.array(httpsUrl).min(1).max(10),
  })
  .strict();
export type FoodResultSpot = z.infer<typeof FoodResultSpotSchema>;

// One city in a results file.
export const FoodResultSchema = z
  .object({
    cityId: recordId,
    spots: z.array(FoodResultSpotSchema).max(120),
  })
  .strict();
export type FoodResult = z.infer<typeof FoodResultSchema>;

export type FoodApplyReport = {
  added: FoodSpot[];
  // Already there under the same name in that city.
  duplicates: string[];
  // Spots whose category isn't one of the trip's.
  unknownCategory: string[];
};

// The new spots a result adds. Spots already there (same city and name,
// archived ones too, so nothing comes back that was set aside) are skipped.
export function applyFoodResult(
  existing: FoodSpot[],
  categories: FoodCategory[],
  result: FoodResult,
  now: Date,
): FoodApplyReport {
  const known = new Set(categories.map((c) => c.id));
  const taken = new Set(existing.map((s) => s.id));
  const names = existing
    .filter((s) => s.cityId === result.cityId)
    .map((s) => s.name);
  const report: FoodApplyReport = {
    added: [],
    duplicates: [],
    unknownCategory: [],
  };
  for (const spot of result.spots) {
    if (!known.has(spot.categoryId)) {
      report.unknownCategory.push(`${spot.categoryId}: ${spot.name}`);
      continue;
    }
    if (names.some((n) => sameName(n, spot.name))) {
      report.duplicates.push(spot.name);
      continue;
    }
    const id = spotId(result.cityId, spot.name, taken);
    taken.add(id);
    names.push(spot.name);
    report.added.push(
      FoodSpotSchema.parse({
        id,
        cityId: result.cityId,
        ...spot,
        origin: "research",
        starred: false,
        lat: null,
        lng: null,
        googlePlaceId: null,
        locationFetchedAt: null,
        locationSource: null,
        archived: false,
        updatedAt: now.toISOString(),
      }),
    );
  }
  return report;
}

// What the researcher gets for each city.
export type FoodResearchRequest = {
  cityId: string;
  name: string;
  stays: { hotelName: string; checkIn: string; checkOut: string }[];
  // The trip's places in the city, by name only (no Google data).
  places: { name: string; category: string }[];
  categories: {
    id: string;
    name: string;
    // How many more spots are wanted to reach the minimum.
    wanted: number;
    request: string | null;
  }[];
  // Spots already there, so they aren't suggested again.
  existing: { categoryId: string; name: string }[];
};

export const MIN_SPOTS_PER_CATEGORY = 3;

// Cities and categories to research: those with fewer than the minimum of
// live spots and those with an open request. `requested` keeps only the
// requests; `only` narrows to one city.
export function foodResearchRequests(
  input: {
    cities: CityRecord[];
    stays: StayRecord[];
    places: {
      cityId: string;
      name: string;
      category: string;
      archived: boolean;
    }[];
    categories: FoodCategory[];
    spots: FoodSpot[];
  },
  options: { requested: boolean; only?: string | null },
): FoodResearchRequest[] {
  const categories = foodCategories(input.categories);
  return input.cities
    .filter((city) => !city.archived)
    .filter((city) => !options.only || city.id === options.only)
    .flatMap((city) => {
      const live = citySpots(input.spots, city.id);
      const wanted = categories.flatMap((category) => {
        const have = live.filter((s) => s.categoryId === category.id).length;
        const requested = isResearchRequested(category);
        if (options.requested && !requested) return [];
        if (!requested && have >= MIN_SPOTS_PER_CATEGORY) return [];
        return [
          {
            id: category.id,
            name: category.name ?? category.key ?? category.id,
            wanted: Math.max(MIN_SPOTS_PER_CATEGORY - have, requested ? 3 : 0),
            request: category.request,
          },
        ];
      });
      if (wanted.length === 0) return [];
      return [
        {
          cityId: city.id,
          name: city.name,
          stays: cityStays(input.stays, city.id).map((s) => ({
            hotelName: s.hotelName,
            checkIn: s.checkIn,
            checkOut: s.checkOut,
          })),
          places: input.places
            .filter((p) => !p.archived && p.cityId === city.id)
            .map((p) => ({ name: p.name, category: p.category })),
          categories: wanted,
          existing: input.spots
            .filter((s) => s.cityId === city.id)
            .map((s) => ({ categoryId: s.categoryId, name: s.name })),
        },
      ];
    });
}
