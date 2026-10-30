"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pageHref } from "@/lib/links";
import { useTripId } from "@/lib/use-trip-id";

export function SettingsLink() {
  const tripId = useTripId();
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={pageHref("/settings/", tripId)}>
        <Settings />
        Settings
      </Link>
    </Button>
  );
}
