"use client";

import Link from "next/link";

import { useMiscItems } from "@/components/app-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { pageHref } from "@/lib/links";
import { useTripId } from "@/lib/use-trip-id";

// Miscellaneous: the to-do lists and the phrasebook, one card each.
export function MiscScreen() {
  const tripId = useTripId();
  const items = useMiscItems();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{t("miscPage.title")}</h1>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link href={pageHref(item.path, tripId)} className="block h-full">
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="size-5 text-primary" aria-hidden />
                      {t(item.label)}
                    </CardTitle>
                    <CardDescription>{t(item.hint)}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
