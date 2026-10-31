"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";

import { NewTripPanel } from "@/components/new-trip";
import { TripName } from "@/components/trip-name";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/auth-store";
import { pageHref } from "@/lib/links";
import { openTrip } from "@/lib/trip-id";
import { useTripId } from "@/lib/use-trip-id";

const NAME_STYLE =
  "max-w-44 truncate font-heading text-base font-semibold tracking-tight";

// The trip name in the header. With other trips to go to, or permission to
// create one, it opens a menu; otherwise it is a link home.
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
          <Button variant="ghost" size="sm" className="-ml-2">
            <span className={NAME_STYLE}>
              <TripName />
            </span>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {trips.map((trip) => (
            <DropdownMenuItem
              key={trip.id}
              onSelect={() => trip.id !== tripId && openTrip(trip.id)}
            >
              <Check className={trip.id === tripId ? "" : "invisible"} />
              {trip.name ?? t("common.myTrip")}
            </DropdownMenuItem>
          ))}
          {canCreate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreating(true)}>
                <Plus />
                {t("gate.newTrip")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {creating && <NewTripPanel onClose={() => setCreating(false)} />}
    </>
  );
}
