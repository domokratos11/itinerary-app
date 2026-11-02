"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BedDouble,
  CalendarOff,
  DatabaseBackup,
  Eraser,
  Globe,
  MapPin,
  Plane,
  Share2,
  Ticket,
  Users,
} from "lucide-react";

import { BackupSettings } from "@/components/settings-backup";
import { CitiesSettings } from "@/components/settings-cities";
import { CleanupSettings } from "@/components/settings-cleanup";
import { FlightsSettings } from "@/components/settings-flights";
import { HolidaysSettings } from "@/components/settings-holidays";
import { PlacesSettings } from "@/components/settings-places";
import { ReservationsSettings } from "@/components/settings-reservations";
import { ShareSettings } from "@/components/settings-share";
import { StaysSettings } from "@/components/settings-stays";
import { TripSettings } from "@/components/settings-trip";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/lib/i18n";
import { useTripStore } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";
import { useReadOnly } from "@/lib/viewer-store";
import { NotOnSharedView } from "@/components/viewer";

const SECTIONS = [
  {
    value: "stays",
    label: "settings.tabStays",
    hint: "settings.hintStays",
    icon: BedDouble,
    Panel: StaysSettings,
  },
  {
    value: "cities",
    label: "settings.tabCities",
    hint: "settings.hintCities",
    icon: Globe,
    Panel: CitiesSettings,
  },
  {
    value: "places",
    label: "settings.tabPlaces",
    hint: "settings.hintPlaces",
    icon: MapPin,
    Panel: PlacesSettings,
  },
  {
    value: "flights",
    label: "settings.tabFlights",
    hint: "settings.hintFlights",
    icon: Plane,
    Panel: FlightsSettings,
  },
  {
    value: "reservations",
    label: "settings.tabBookings",
    hint: "settings.hintBookings",
    icon: Ticket,
    Panel: ReservationsSettings,
  },
  {
    value: "holidays",
    label: "settings.tabHolidays",
    hint: "settings.hintHolidays",
    icon: CalendarOff,
    Panel: HolidaysSettings,
  },
  {
    value: "trip",
    label: "settings.tabTrip",
    hint: "settings.hintTrip",
    icon: Users,
    Panel: TripSettings,
  },
  {
    value: "share",
    label: "settings.tabShare",
    hint: "settings.hintShare",
    icon: Share2,
    Panel: ShareSettings,
  },
  {
    value: "backup",
    label: "settings.tabBackup",
    hint: "settings.hintBackup",
    icon: DatabaseBackup,
    Panel: BackupSettings,
  },
  {
    value: "cleanup",
    label: "settings.tabCleanup",
    hint: "settings.hintCleanup",
    icon: Eraser,
    Panel: CleanupSettings,
  },
] as const;

// Trip settings: the cities, hotels, places and reservations the trip is
// built from. Every change is live for everyone on the trip. There are too
// many sections for a row of tabs: phones choose from a menu, wider screens
// from a list down the side, and more can be added to either.
export function SettingsScreen() {
  const tripId = useTripId();
  const asked = useSearchParams().get("tab");
  const [section, setSection] = useState(
    SECTIONS.find((s) => s.value === asked)?.value ?? "stays",
  );
  const error = useTripStore((s) => s.error);
  const readOnly = useReadOnly();

  // Never reached from a read-only link's menus; this covers a typed address.
  if (readOnly) return <NotOnSharedView />;

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
        <Tabs
          value={section}
          onValueChange={(v) => setSection(v as typeof section)}
          orientation="vertical"
          className="flex-col gap-4 md:flex-row md:items-start md:gap-6"
        >
          <Select
            value={section}
            onValueChange={(v) => setSection(v as typeof section)}
          >
            <SelectTrigger
              aria-label={t("settings.section")}
              className="w-full md:hidden"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map(({ value, label, icon: Icon }) => (
                <SelectItem key={value} value={value}>
                  <Icon />
                  {t(label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TabsList className="sticky top-20 hidden w-52 shrink-0 items-stretch md:flex">
            {SECTIONS.map(({ value, label, hint, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="flex-none">
                {/* On the inside: a tooltip's trigger would take over the
                    tab's own selected state. */}
                <Tip side="right" label={t(hint)}>
                  <span className="flex w-full items-center gap-2">
                    <Icon />
                    {t(label)}
                  </span>
                </Tip>
              </TabsTrigger>
            ))}
          </TabsList>
          {SECTIONS.map(({ value, hint, Panel }) => (
            <TabsContent key={value} value={value} className="w-full min-w-0">
              <p className="pb-4 text-sm text-muted-foreground">{t(hint)}</p>
              <Panel tripId={tripId} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
