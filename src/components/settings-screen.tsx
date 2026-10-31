"use client";

import { useSearchParams } from "next/navigation";

import { BackupSettings } from "@/components/settings-backup";
import { CitiesSettings } from "@/components/settings-cities";
import { HolidaysSettings } from "@/components/settings-holidays";
import { PlacesSettings } from "@/components/settings-places";
import { ReservationsSettings } from "@/components/settings-reservations";
import { StaysSettings } from "@/components/settings-stays";
import { TripSettings } from "@/components/settings-trip";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/lib/i18n";
import { useTripStore } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

// Trip settings: the cities, hotels, places and reservations the trip is
// built from. Every change is live for everyone on the trip.
export function SettingsScreen() {
  const tripId = useTripId();
  const tab = useSearchParams().get("tab") ?? "stays";
  const error = useTripStore((s) => s.error);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.intro")}</p>
        {error && (
          <Badge
            variant="destructive"
            className="h-auto py-1 whitespace-normal"
          >
            {t("settings.cantReach", { error })}
          </Badge>
        )}
      </header>

      {tripId && (
        <Tabs defaultValue={tab}>
          <TabsList className="w-full flex-wrap justify-start gap-y-1 rounded-2xl group-data-horizontal/tabs:h-auto lg:w-fit">
            <TabsTrigger value="stays">{t("settings.tabStays")}</TabsTrigger>
            <TabsTrigger value="cities">{t("settings.tabCities")}</TabsTrigger>
            <TabsTrigger value="places">{t("settings.tabPlaces")}</TabsTrigger>
            <TabsTrigger value="reservations">
              {t("settings.tabBookings")}
            </TabsTrigger>
            <TabsTrigger value="holidays">
              {t("settings.tabHolidays")}
            </TabsTrigger>
            <TabsTrigger value="trip">{t("settings.tabTrip")}</TabsTrigger>
            <TabsTrigger value="backup">{t("settings.tabBackup")}</TabsTrigger>
          </TabsList>
          <TabsContent value="stays" className="pt-2">
            <StaysSettings tripId={tripId} />
          </TabsContent>
          <TabsContent value="cities" className="pt-2">
            <CitiesSettings tripId={tripId} />
          </TabsContent>
          <TabsContent value="places" className="pt-2">
            <PlacesSettings tripId={tripId} />
          </TabsContent>
          <TabsContent value="reservations" className="pt-2">
            <ReservationsSettings tripId={tripId} />
          </TabsContent>
          <TabsContent value="holidays" className="pt-2">
            <HolidaysSettings tripId={tripId} />
          </TabsContent>
          <TabsContent value="trip" className="pt-2">
            <TripSettings tripId={tripId} />
          </TabsContent>
          <TabsContent value="backup" className="pt-2">
            <BackupSettings tripId={tripId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
