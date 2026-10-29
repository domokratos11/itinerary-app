import { notFound } from "next/navigation";

import { CityCatalog } from "@/components/city-catalog";
import { cities, cityById, nearby, placesForCity } from "@/lib/catalog";

// Only the six cities in data/cities.json exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return cities.map((city) => ({ cityId: city.id }));
}

// Server Component: the catalog is read at build time and handed to the
// client-side filters.
export default async function CityPage({
  params,
}: {
  params: Promise<{ cityId: string }>;
}) {
  const { cityId } = await params;
  const city = cityById(cityId);
  if (!city) notFound();

  const places = placesForCity(cityId);
  const nearbyForCity = Object.fromEntries(
    places.map((p) => [
      p.id,
      (nearby[p.id] ?? []).map((n) => ({ id: n.id, name: n.name })),
    ]),
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <CityCatalog city={city} places={places} nearby={nearbyForCity} />
    </main>
  );
}
