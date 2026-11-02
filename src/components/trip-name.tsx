"use client";

import { t } from "@/lib/i18n";
import { useActiveTrip } from "@/lib/auth-store";
import { useViewerStore } from "@/lib/viewer-store";

// The open trip's name. Trips made before names existed have none. On a
// read-only link it comes with the link.
export function TripName() {
  const trip = useActiveTrip();
  const shared = useViewerStore((s) => s.share?.tripName ?? null);
  return <>{trip?.name ?? shared ?? t("common.myTrip")}</>;
}
