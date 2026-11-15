"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, LayoutList, Plus } from "lucide-react";

import { NewTripPanel } from "@/components/new-trip";
import { TripName } from "@/components/trip-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TripSummary } from "@/domain/trip-repository";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/auth-store";
import { formatDateRange } from "@/lib/format-day";
import { pageHref } from "@/lib/links";
import { openTrip, openTripPicker } from "@/lib/trip-id";
import { useTripId } from "@/lib/use-trip-id";

const NAME_STYLE =
  "max-w-44 truncate font-heading text-lg font-semibold";

// A trip's name, its dates when it has them, and whether its setup is still
// to be finished. Shared by this menu and the picker after sign-in.
export function TripSummaryText({ trip }: { trip: TripSummary }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
      <span className="w-full truncate font-medium">
        {trip.name ?? t("common.myTrip")}
      </span>
      {(trip.startDate && trip.endDate) || trip.setup === "pending" ? (
        <span className="flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground">
          {trip.startDate && trip.endDate && (
            <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
          )}
          {trip.setup === "pending" && (
            <Badge variant="secondary">{t("gate.notSetUp")}</Badge>
          )}
        </span>
      ) : null}
    </span>
  );
}

// The trip name in the header, on phones and wide screens alike. With other
// trips to go to, or permission to create one, it opens a menu; otherwise it
// is a link home.
export function TripSwitcher() {
  const tripId = useTripId();
  const trips = useAuthStore((s) => s.trips) ?? [];
  const canCreate = useAuthStore((s) => s.canCreateTrips);
  const [creating, setCreating] = useState(false);

  if (trips.length <= 1 && !canCreate)
    return (
      <Link href={pageHref("/", tripId)} className={NAME_STYLE}>
        <TripName />
      </Link>
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-2 min-w-0">
            <span className={NAME_STYLE}>
              <TripName />
            </span>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        {/* Many trips scroll inside the menu, which keeps to the screen. */}
        <DropdownMenuContent
          align="start"
          className="max-h-[min(70svh,32rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto"
        >
          {trips.map((trip) => (
            <DropdownMenuItem
              key={trip.id}
              className="items-start"
              onSelect={() => trip.id !== tripId && openTrip(trip.id)}
            >
              <Check
                className={trip.id === tripId ? "mt-0.5" : "invisible mt-0.5"}
              />
              <TripSummaryText trip={trip} />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openTripPicker}>
            <LayoutList />
            {t("gate.allTrips")}
          </DropdownMenuItem>
          {canCreate && (
            <DropdownMenuItem onSelect={() => setCreating(true)}>
              <Plus />
              {t("gate.newTrip")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {creating && <NewTripPanel onClose={() => setCreating(false)} />}
    </>
  );
}
