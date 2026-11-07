"use client";

import Link from "next/link";

import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { pageHref } from "@/lib/links";
import { useTripId } from "@/lib/use-trip-id";

// Catches a crash in any page. The root layout (header, tab bar) stays, so
// the rest of the app is still a tap away.
export default function PageError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const tripId = useTripId();
  return (
    <ErrorScreen error={error}>
      <Button onClick={() => retry()}>{t("error.retry")}</Button>
      <Button variant="outline" asChild>
        <Link href={pageHref("/", tripId)}>{t("error.goHome")}</Link>
      </Button>
    </ErrorScreen>
  );
}
