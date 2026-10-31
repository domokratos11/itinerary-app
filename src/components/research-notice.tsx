"use client";

import Link from "next/link";

import { pageHref } from "@/lib/links";
import { useProposals } from "@/lib/use-proposals";
import { useTripId } from "@/lib/use-trip-id";

// On the home page, when research has come back and is waiting for a person.
export function ResearchNotice() {
  const tripId = useTripId();
  const ready = useProposals(tripId).filter((p) => p.status === "ready").length;
  if (ready === 0) return null;
  return (
    <Link
      href={pageHref("/settings/", tripId, { tab: "places" })}
      className="rounded-lg border bg-muted px-3 py-2 text-sm underline-offset-2 hover:underline"
    >
      {ready} {ready === 1 ? "place has" : "places have"} research to review
    </Link>
  );
}
