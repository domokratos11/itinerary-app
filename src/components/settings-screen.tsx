"use client";

import Link from "next/link";

import { BackupSettings } from "@/components/settings-backup";
import { CitiesSettings } from "@/components/settings-cities";
import { ReservationsSettings } from "@/components/settings-reservations";
import { StaysSettings } from "@/components/settings-stays";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { homeHref } from "@/lib/links";
import { useTripStore } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

// Trip settings: the cities, hotels and reservations the days are built
// from. Every change is live for everyone with the trip link.
export function SettingsScreen() {
  const tripId = useTripId();
  const live = useTripStore((s) => s.live);
  const error = useTripStore((s) => s.error);
  const seeded = Object.values(live).some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link
          href={homeHref(tripId)}
          className="text-sm text-muted-foreground underline"
        >
          ← Trip days
        </Link>
        <h1 className="text-2xl font-semibold">Trip settings</h1>
        <p className="text-sm text-muted-foreground">
          The days are built from the stays: change a hotel&apos;s dates and the
          days follow.
        </p>
        {error ? (
          <Badge
            variant="destructive"
            className="h-auto py-1 whitespace-normal"
          >
            Can&apos;t reach the trip: {error}
          </Badge>
        ) : (
          !seeded &&
          tripId && (
            <Badge variant="outline" className="h-auto py-1 whitespace-normal">
              Showing the built-in trip. Your first change here copies it into
              the shared database.
            </Badge>
          )
        )}
      </header>

      {!tripId ? (
        <p className="text-sm text-muted-foreground">
          Open your shared link with ?trip= to edit the trip.
        </p>
      ) : (
        <Tabs defaultValue="stays">
          <TabsList className="w-full">
            <TabsTrigger value="stays">Stays</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
            <TabsTrigger value="reservations">Bookings</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>
          <TabsContent value="stays" className="pt-2">
            <StaysSettings tripId={tripId} />
          </TabsContent>
          <TabsContent value="cities" className="pt-2">
            <CitiesSettings tripId={tripId} />
          </TabsContent>
          <TabsContent value="reservations" className="pt-2">
            <ReservationsSettings tripId={tripId} />
          </TabsContent>
          <TabsContent value="backup" className="pt-2">
            <BackupSettings tripId={tripId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
