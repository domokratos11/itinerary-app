"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { SignOutButton } from "@/components/auth-gate";
import { BackupSettings } from "@/components/settings-backup";
import { CitiesSettings } from "@/components/settings-cities";
import { HolidaysSettings } from "@/components/settings-holidays";
import { PlacesSettings } from "@/components/settings-places";
import { ReservationsSettings } from "@/components/settings-reservations";
import { StaysSettings } from "@/components/settings-stays";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/auth-store";
import { homeHref } from "@/lib/links";
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
        {error && (
          <Badge
            variant="destructive"
            className="h-auto py-1 whitespace-normal"
          >
            Can&apos;t reach the trip: {error}
          </Badge>
        )}
      </header>

      {!tripId ? (
        <p className="text-sm text-muted-foreground">
          Open your shared link with ?trip= to edit the trip.
        </p>
      ) : (
        <Tabs defaultValue={tab}>
          <TabsList className="h-auto w-full flex-wrap">
            <TabsTrigger value="stays">Stays</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
            <TabsTrigger value="places">Places</TabsTrigger>
            <TabsTrigger value="reservations">Bookings</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
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
          <TabsContent value="backup" className="pt-2">
            <BackupSettings tripId={tripId} />
          </TabsContent>
        </Tabs>
      )}

      {tripId && <AccountSettings />}
    </div>
  );
}

// Who is signed in on this device. Signing out also removes the trip's
// offline copy from it.
function AccountSettings() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      <h2 className="text-base font-semibold">Account</h2>
      <p className="text-sm text-muted-foreground">
        Signed in as {user.email ?? user.name ?? "a Google account"}. Signing
        out removes the trip from this device; changes made offline that
        haven&apos;t synced yet are lost.
      </p>
      <div>
        <SignOutButton label="Sign out" variant="outline" />
      </div>
    </section>
  );
}
