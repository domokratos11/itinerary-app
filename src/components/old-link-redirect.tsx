"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { BASE_PATH } from "@/lib/base-path";
import { pageHref } from "@/lib/links";
import { recallTripId } from "@/lib/trip-id";

// Day and city pages used to be /day/2026-12-18/ and /city/nagoya/. Links
// saved on phones still point there, so the 404 page forwards them to
// /day/?date= and /city/?id=, keeping ?trip=.
export function newAddressFor(pathname: string, search: string): string | null {
  const path = pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length)
    : pathname;
  const trip = new URLSearchParams(search).get("trip") ?? recallTripId();
  const day = path.match(/^\/day\/(\d{4}-\d{2}-\d{2})\/?$/);
  if (day) return pageHref("/day/", trip, { date: day[1] });
  const city = path.match(/^\/city\/([a-z0-9-]+)\/?$/);
  if (city) return pageHref("/city/", trip, { id: city[1] });
  return null;
}

export function OldLinkRedirect() {
  const router = useRouter();
  useEffect(() => {
    const next = newAddressFor(
      window.location.pathname,
      window.location.search,
    );
    if (next) router.replace(next);
  }, [router]);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link href="/" className="text-sm underline">
        ← Trip days
      </Link>
    </div>
  );
}
