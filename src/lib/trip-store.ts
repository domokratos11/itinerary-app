"use client";

import { useMemo } from "react";
import { create } from "zustand";

import type { TripDay } from "@/domain/days";
import type { CityRecord, PlaceRecord } from "@/domain/schemas";
import {
  activeTrip,
  EMPTY_TRIP,
  tripDays,
  type TripCollection,
  type TripData,
  type TripRecordOf,
} from "@/domain/trip";

type TripState = {
  data: TripData;
  // Collections Firestore has answered for, empty or not.
  loaded: Record<TripCollection, boolean>;
  error: string | null;
  setCollection: <C extends TripCollection>(
    collection: C,
    records: TripRecordOf[C][],
  ) => void;
  // Shows a local change before the save completes, replacing by id.
  apply: <C extends TripCollection>(
    collection: C,
    record: TripRecordOf[C],
  ) => void;
  setError: (message: string) => void;
  reset: () => void;
};

const notLoaded = {
  cities: false,
  stays: false,
  reservations: false,
  places: false,
  holidays: false,
};

// Fed by the Firestore listener in use-trip-sync. Firestore is the only
// source: an empty collection shows as empty.
export const useTripStore = create<TripState>()((set) => ({
  data: EMPTY_TRIP,
  loaded: notLoaded,
  error: null,
  setCollection: (name, records) =>
    set((state) => ({
      loaded: { ...state.loaded, [name]: true },
      data: { ...state.data, [name]: records },
      error: null,
    })),
  apply: (name, record) =>
    set((state) => {
      const rows = state.data[name] as TripRecordOf[typeof name][];
      const next = rows.some((r) => r.id === record.id)
        ? rows.map((r) => (r.id === record.id ? record : r))
        : [...rows, record];
      return { data: { ...state.data, [name]: next } };
    }),
  setError: (message) => set({ error: message }),
  reset: () => set({ data: EMPTY_TRIP, loaded: notLoaded, error: null }),
}));

// The trip as screens see it: archived records hidden, sorted.
export function useTrip(): TripData {
  const data = useTripStore((s) => s.data);
  return useMemo(() => activeTrip(data), [data]);
}

export function useTripDays(): TripDay[] {
  const trip = useTrip();
  return useMemo(() => tripDays(trip), [trip]);
}

export function usePlacesById(): Map<string, PlaceRecord> {
  // Archived places stay findable, so old plan items keep their names.
  const places = useTripStore((s) => s.data.places);
  return useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
}

export function useCitiesById(): Map<string, CityRecord> {
  const cities = useTripStore((s) => s.data.cities);
  return useMemo(() => new Map(cities.map((c) => [c.id, c])), [cities]);
}
