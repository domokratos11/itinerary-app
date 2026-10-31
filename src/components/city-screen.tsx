"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { CityCatalog } from "@/components/city-catalog";
import { nearbyByPlace } from "@/lib/catalog-filter";
import { homeHref } from "@/lib/links";
import { useCitiesById, useTrip } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

// /city/?id=<cityId>. Places come from the live trip, so draft places from
// the queue show up here too.
export function CityScreen() {
  const params = useSearchParams();
  const cityId = params.get("id") ?? "";
  const placeId = params.get("place");
  const tripId = useTripId();
  const trip = useTrip();
  const city = useCitiesById().get(cityId);
  const places = useMemo(
    () => trip.places.filter((p) => p.cityId === cityId),
    [trip.places, cityId],
  );
  const nearby = useMemo(() => {
    const all = nearbyByPlace(trip.places);
    return Object.fromEntries(
      places.map((p) => [
        p.id,
        (all[p.id] ?? []).map((n) => ({ id: n.id, name: n.name })),
      ]),
    );
  }, [trip.places, places]);

  if (!city || city.archived) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">City not found</h1>
        <Link href={homeHref(tripId)} className="text-sm underline">
          ← Trip days
        </Link>
      </div>
    );
  }

  return (
    <CityCatalog
      key={`${cityId}-${placeId ?? ""}`}
      city={city}
      places={places}
      tripId={tripId}
      nearby={nearby}
      initialPlaceId={placeId}
    />
  );
}
