import { deriveDays, type TripDay } from "./days";
import { stayLocation, type Location } from "./plan";
import type {
  City,
  CityRecord,
  Place,
  PlaceRecord,
  PlanItem,
  ReservationRecord,
  Stay,
  StayRecord,
  TripFile,
} from "./schemas";

// The trip's structure: everything except the plan items. Lives in
// Firestore under trips/{tripId}; the data/ files are its seed.
export type TripData = {
  cities: CityRecord[];
  stays: StayRecord[];
  reservations: ReservationRecord[];
  places: PlaceRecord[];
};

export type TripCollection = keyof TripData;
export const TRIP_COLLECTIONS: TripCollection[] = [
  "cities",
  "stays",
  "reservations",
  "places",
];

export type TripRecordOf = {
  [C in TripCollection]: TripData[C][number];
};

// Seed ids are stable, so running the seed twice finds the same documents.
export function stayId(stay: Pick<Stay, "cityId" | "checkIn">): string {
  return `${stay.cityId}-${stay.checkIn}`;
}

export function seedTrip(
  input: { cities: City[]; trip: TripFile; places: Place[] },
  now: Date,
): TripData {
  const updatedAt = now.toISOString();
  const base = { archived: false, updatedAt };
  return {
    cities: input.cities.map((c) => ({ ...c, ...base })),
    stays: input.trip.stays.map((s) => ({
      ...s,
      id: stayId(s),
      note: null,
      ...base,
    })),
    reservations: input.trip.reservations.map((r, i) => ({
      ...r,
      id: `${r.type}-${r.date}-${i + 1}`,
      ...base,
    })),
    places: input.places.map((p) => ({
      ...p,
      status: "researched" as const,
      source: "catalog" as const,
      ...base,
    })),
  };
}

// What screens show: archived records hidden, in a stable order. Cities
// follow the trip (first check-in), places keep their saved order.
export function activeTrip(data: TripData): TripData {
  const stays = data.stays
    .filter((s) => !s.archived)
    .sort((a, b) =>
      a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0,
    );
  const firstStay = new Map<string, string>();
  for (const s of stays)
    if (!firstStay.has(s.cityId)) firstStay.set(s.cityId, s.checkIn);
  const cities = data.cities
    .filter((c) => !c.archived)
    .sort((a, b) => {
      const da = firstStay.get(a.id) ?? "9999";
      const db = firstStay.get(b.id) ?? "9999";
      return da < db ? -1 : da > db ? 1 : a.name.localeCompare(b.name);
    });
  const reservations = data.reservations
    .filter((r) => !r.archived)
    .sort((a, b) => {
      const ka = `${a.date} ${a.time ?? ""}`;
      const kb = `${b.date} ${b.time ?? ""}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  return {
    cities,
    stays,
    reservations,
    places: data.places.filter((p) => !p.archived),
  };
}

export function tripDays(data: TripData): TripDay[] {
  return deriveDays(data.stays);
}

export type Endpoint = { name: string; location: Location | null };

// A hotel with no name yet ("To be decided") has no location to route to.
export function endpointFor(stay: Stay | null): Endpoint | null {
  if (!stay) return null;
  const undecided = stay.hotelName.toLowerCase().startsWith("to be decided");
  return {
    name: undecided ? "Hotel to be decided" : stay.hotelName,
    location: undecided ? null : stayLocation(stay),
  };
}

export type StrandedItem = {
  item: PlanItem;
  reason: "outside-trip" | "city-not-here";
};

// Active plan items left behind by a change to the stays: their date is no
// longer a trip day, or their place's city isn't on that day any more.
export function strandedItems(
  items: PlanItem[],
  days: TripDay[],
  places: Pick<Place, "id" | "cityId">[],
): StrandedItem[] {
  const dayByDate = new Map(days.map((d) => [d.date, d]));
  const cityOf = new Map(places.map((p) => [p.id, p.cityId]));
  return items.flatMap((item): StrandedItem[] => {
    if (item.status === "removed") return [];
    const day = dayByDate.get(item.date);
    if (!day) return [{ item, reason: "outside-trip" }];
    const cityId = cityOf.get(item.placeId);
    if (cityId && !day.cityIds.includes(cityId))
      return [{ item, reason: "city-not-here" }];
    return [];
  });
}

export type StayGroup<S extends Stay = Stay> = {
  stay: S | null;
  days: TripDay[];
};

// The days grouped by the hotel slept in that night, in order. A transfer
// day goes with the hotel you arrive at; the last day goes with the last
// hotel. Nights with no hotel form their own groups.
export function groupDaysByStay<S extends Stay>(
  days: TripDay[],
  stays: S[],
): StayGroup<S>[] {
  const groups: StayGroup<S>[] = [];
  for (const day of days) {
    const stay =
      stays.find((s) => s.checkIn <= day.date && day.date < s.checkOut) ??
      stays.find((s) => s.checkOut === day.date) ??
      null;
    const last = groups.at(-1);
    if (last && last.stay === stay) last.days.push(day);
    else groups.push({ stay, days: [day] });
  }
  return groups;
}
