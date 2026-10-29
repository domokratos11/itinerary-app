import citiesJson from "../../data/cities.json";
import tripJson from "../../data/trip.json";
import placesTokyoUeno from "../../data/places/tokyo-ueno.json";
import placesNagoya from "../../data/places/nagoya.json";
import placesHiroshima from "../../data/places/hiroshima.json";
import placesOsaka from "../../data/places/osaka.json";
import placesKawaguchiko from "../../data/places/kawaguchiko.json";
import placesTokyoAsakusa from "../../data/places/tokyo-asakusa.json";
import {
  CitiesFileSchema,
  PlacesFileSchema,
  TripFileSchema,
  type City,
  type Place,
} from "@/domain/schemas";
import { nearbyByPlace } from "@/lib/catalog-filter";

// Catalog data is read at build time. Each file is parsed with its schema so
// the types are checked here as well as by `npm run validate`.
export const cities: City[] = CitiesFileSchema.parse(citiesJson);
export const trip = TripFileSchema.parse(tripJson);

export const allPlaces: Place[] = [
  ...PlacesFileSchema.parse(placesTokyoUeno),
  ...PlacesFileSchema.parse(placesNagoya),
  ...PlacesFileSchema.parse(placesHiroshima),
  ...PlacesFileSchema.parse(placesOsaka),
  ...PlacesFileSchema.parse(placesKawaguchiko),
  ...PlacesFileSchema.parse(placesTokyoAsakusa),
];

// Nearby saved places for every place, computed once for the whole catalog.
export const nearby = nearbyByPlace(allPlaces);

export function cityById(id: string): City | undefined {
  return cities.find((c) => c.id === id);
}

export function placesForCity(cityId: string): Place[] {
  return allPlaces.filter((p) => p.cityId === cityId);
}
