import { TripPlanStatus } from "@/components/trip-plan-status";
import { TripDays, type DayView } from "@/components/trip-days";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deriveDays } from "@/domain/days";
import { cityById, trip } from "@/lib/catalog";

// Server Component: the day list is computed at build time from data/trip.json.
function formatLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function Home() {
  const days: DayView[] = deriveDays(trip.stays).map((day) => ({
    date: day.date,
    label: formatLabel(day.date),
    cities: day.cityIds.map((id) => {
      const city = cityById(id);
      return { id, name: city?.name ?? id, color: city?.color ?? "#64748b" };
    }),
  }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">Japan Trip 2026–27</h1>
          </CardTitle>
          <CardDescription>Dec 15, 2026 – Jan 12, 2027</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <TripPlanStatus />
        </CardContent>
      </Card>
      <TripDays days={days} />
    </main>
  );
}
