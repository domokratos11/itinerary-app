import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DayPlan, type Endpoint } from "@/components/day-plan";
import { deriveDays } from "@/domain/days";
import { hotelsForDay, stayLocation } from "@/domain/plan";
import type { Stay } from "@/domain/schemas";
import { cityById, trip } from "@/lib/catalog";
import { formatDayLabel } from "@/lib/format-day";

const tripDays = deriveDays(trip.stays);

// Only the trip's own dates exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return tripDays.map((d) => ({ date: d.date }));
}

// A hotel with no name yet (Hiroshima) has no location to route to.
function endpointFor(stay: Stay | null): Endpoint | null {
  if (!stay) return null;
  const undecided = stay.hotelName.toLowerCase().startsWith("to be decided");
  return {
    name: undecided ? "Hotel to be decided" : stay.hotelName,
    location: undecided ? null : stayLocation(stay),
  };
}

// Server Component: the day, its hotels and its reservations are fixed at
// build time. The stops are live from the plan store.
export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const day = tripDays.find((d) => d.date === date);
  if (!day) notFound();

  const { start, end } = hotelsForDay(date, trip.stays);
  const cities = day.cityIds.map((id) => cityById(id)?.name ?? id);
  const reservations = trip.reservations.filter((r) => r.date === date);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <Suspense fallback={null}>
        <DayPlan
          date={date}
          label={formatDayLabel(date)}
          cityNames={cities}
          cityIds={day.cityIds}
          start={endpointFor(start)}
          end={endpointFor(end)}
          reservations={reservations}
        />
      </Suspense>
    </main>
  );
}
