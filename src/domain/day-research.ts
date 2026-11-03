import { z } from "zod";

import { distanceKm } from "@/lib/geo";
import { placePoint } from "./map-pins";
import {
  DayAnalysisSchema,
  type DayResearch,
  type FlightRecord,
  type Holiday,
  type PlaceRecord,
  type PlanItem,
  type Proposal,
  type Reservation,
} from "./schemas";

// Research of a whole day. Like the plan, screens use this interface and never
// the Firebase SDK.
export interface DayResearchRepository {
  subscribe(
    tripId: string,
    onRows: (rows: DayResearch[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  save(tripId: string, row: DayResearch): Promise<void>;
}

export function isOpenDayResearch(row: DayResearch | null | undefined) {
  return row?.status === "requested";
}

// Asking for a day, or asking again. The last analysis stays until a new one
// replaces it, so the day never goes blank while it waits.
export function requestDay(
  date: string,
  request: string,
  existing: DayResearch | null,
  now: Date,
): DayResearch {
  const stamp = now.toISOString();
  return {
    id: date,
    date,
    status: "requested",
    request: request.trim() || null,
    analysis:
      existing?.status === "archived" ? null : (existing?.analysis ?? null),
    requestedAt: stamp,
    updatedAt: stamp,
  };
}

// The places of a day's stops that are still to do, in order.
export function dayPlaces(
  date: string,
  items: PlanItem[],
  places: Map<string, PlaceRecord>,
): PlaceRecord[] {
  return items
    .filter((i) => i.date === date && i.status !== "removed")
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    .flatMap((i) => {
      const place = places.get(i.placeId);
      return place && !place.archived ? [place] : [];
    });
}

// The day's research waiting for review: ready proposals for its places.
export function dayProposals(
  proposals: Proposal[],
  placesOfDay: PlaceRecord[],
): Proposal[] {
  const ids = new Set(placesOfDay.map((p) => p.id));
  return proposals.filter((p) => p.status === "ready" && ids.has(p.placeId));
}

// What a research run gets for one day: the stops with what's known of them,
// the hotel, bookings and holiday, and the straight-line distances between
// stops. Distances are worked out here and only go into the run's own
// git-ignored file; no coordinates are written anywhere.
export function dayBrief(input: {
  research: DayResearch;
  weekday: string;
  cities: string[];
  hotel: string | null;
  holiday: Pick<Holiday, "name" | "kind" | "note"> | null;
  reservations: Pick<Reservation, "type" | "time" | "from" | "to">[];
  flights: Pick<
    FlightRecord,
    "flightNumber" | "departDate" | "departTime" | "arriveDate" | "arriveTime"
  >[];
  stops: PlaceRecord[];
  proposalIds: Map<string, string>;
  // Worked out from the city's own coordinates, when they were found.
  sun?: { sunrise: string; sunset: string } | null;
}) {
  const points = input.stops.map(placePoint);
  const kmBetweenStops = points.slice(1).map((point, i) => {
    const before = points[i];
    return point && before
      ? Math.round(distanceKm(before, point) * 10) / 10
      : null;
  });
  return {
    date: input.research.date,
    weekday: input.weekday,
    request: input.research.request,
    cities: input.cities,
    hotel: input.hotel,
    sunrise: input.sun?.sunrise ?? null,
    sunset: input.sun?.sunset ?? null,
    holiday: input.holiday,
    reservations: input.reservations,
    flights: input.flights,
    stops: input.stops.map((place) => ({
      placeId: place.id,
      proposalId: input.proposalIds.get(place.id) ?? null,
      name: place.name,
      category: place.category,
      priority: place.priority,
      mapsUrl: place.mapsUrl,
      openingHours: place.openingHours,
      closedDates: place.closedDates,
      seasonFrom: place.seasonFrom,
      seasonTo: place.seasonTo,
      durationMin: place.durationMin,
      nearestStation: place.nearestStation,
    })),
    kmBetweenStops,
    previousAnalysis: input.research.analysis,
  };
}

// One day in a results file. The time it was researched is set on push.
export const DayResultSchema = z.object({
  date: z.iso.date(),
  analysis: DayAnalysisSchema.omit({ researchedAt: true }),
});

export type DayResult = z.infer<typeof DayResultSchema>;
