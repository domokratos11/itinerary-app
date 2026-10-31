"use client";

import { t } from "@/lib/i18n";
import { useActiveTrip } from "@/lib/auth-store";

// The open trip's name. Trips made before names existed have none.
export function TripName() {
  const trip = useActiveTrip();
  return <>{trip?.name ?? t("common.myTrip")}</>;
}
