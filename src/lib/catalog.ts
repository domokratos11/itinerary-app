import citiesJson from "../../data/cities.json";
import tripJson from "../../data/trip.json";
import holidaysJson from "../../data/holidays.json";
import placesTokyoUeno from "../../data/places/tokyo-ueno.json";
import placesNagoya from "../../data/places/nagoya.json";
import placesHiroshima from "../../data/places/hiroshima.json";
import placesOsaka from "../../data/places/osaka.json";
import placesKawaguchiko from "../../data/places/kawaguchiko.json";
import placesTokyoAsakusa from "../../data/places/tokyo-asakusa.json";
import {
  CitiesFileSchema,
  HolidaysFileSchema,
  PlacesFileSchema,
  TripFileSchema,
  type City,
  type Holiday,
  type Place,
} from "@/domain/schemas";
import { seedTrip, type TripData } from "@/domain/trip";

// The seed: the data/ files, bundled with the app. The live trip is in
// Firestore; the app shows the seed until Firestore answers, and for any
// collection that is still empty (before `npm run seed`).
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

// Holidays and closure periods: reference data, the same for every trip.
export const holidays: Holiday[] = HolidaysFileSchema.parse(holidaysJson);

// A fixed time, so the seed is the same in every build.
const SEED_TIME = new Date("2026-10-29T00:00:00.000Z");

export const seed: TripData = seedTrip(
  { cities, trip, places: allPlaces },
  SEED_TIME,
);
