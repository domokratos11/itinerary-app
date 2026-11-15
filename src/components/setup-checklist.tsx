"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BedDouble,
  ChevronRight,
  Globe,
  MapPin,
  Plane,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setupChecklist, type SetupPart } from "@/domain/setup";
import { t } from "@/lib/i18n";
import { useActiveTrip } from "@/lib/auth-store";
import { pageHref } from "@/lib/links";
import { useTrip } from "@/lib/trip-store";
import { useReadOnly } from "@/lib/viewer-store";

const PART: Record<
  SetupPart,
  { icon: LucideIcon; path: string; tab?: string }
> = {
  cities: { icon: Globe, path: "/settings/", tab: "cities" },
  hotels: { icon: BedDouble, path: "/settings/", tab: "stays" },
  flights: { icon: Plane, path: "/settings/", tab: "flights" },
  budget: { icon: Wallet, path: "/budget/" },
  places: { icon: MapPin, path: "/settings/", tab: "places" },
};

// A preference of this browser, not trip data: hiding the card here leaves
// it for everyone else.
const dismissKey = (tripId: string) => `setup-checklist-hidden:${tripId}`;

function isDismissed(tripId: string): boolean {
  try {
    return window.localStorage.getItem(dismissKey(tripId)) === "1";
  } catch {
    return false;
  }
}

function dismiss(tripId: string): void {
  try {
    window.localStorage.setItem(dismissKey(tripId), "1");
  } catch {
    // Not remembered: the card is hidden until the next page load.
  }
}

// The parts of an itinerary set up with the wizard that are still empty,
// with hide() for this browser. Empty once nothing is missing or when hidden,
// on a read-only link, and for a trip made before the wizard (it has no
// `setup` field).
export function useSetupChecklist(tripId: string | null): {
  tripId: string | null;
  missing: SetupPart[];
  hide: () => void;
} {
  const trip = useActiveTrip();
  const data = useTrip();
  const readOnly = useReadOnly();
  // Kept with the trip it was read for, so another trip reads its own.
  const [hidden, setHidden] = useState<{ tripId: string | null; yes: boolean }>(
    () => ({ tripId, yes: tripId ? isDismissed(tripId) : false }),
  );
  const isHidden =
    hidden.tripId === tripId
      ? hidden.yes
      : tripId
        ? isDismissed(tripId)
        : false;
  const missing =
    readOnly || !tripId || !trip || isHidden
      ? []
      : setupChecklist({ trip, data, setup: trip.setup });
  return {
    tripId,
    missing,
    hide: () => {
      if (tripId) dismiss(tripId);
      setHidden({ tripId, yes: true });
    },
  };
}

// "Finish setting up": each missing part linked to where it is filled in.
export function SetupChecklist({
  tripId,
  missing,
  hide,
}: {
  tripId: string | null;
  missing: SetupPart[];
  hide: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("setupChecklist.title")}</CardTitle>
        <CardDescription>{t("setupChecklist.body")}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("setupChecklist.dismiss")}
            onClick={hide}
          >
            <X />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {missing.map((part) => {
            const { icon: Icon, path, tab } = PART[part];
            return (
              <li key={part}>
                <Link
                  href={pageHref(path, tripId, tab ? { tab } : undefined)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium hover:bg-muted"
                >
                  <Icon aria-hidden className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    {t(`setupChecklist.part.${part}`)}
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
