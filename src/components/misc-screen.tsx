"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useMiscItems } from "@/components/app-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BASE_PATH } from "@/lib/base-path";
import { t } from "@/lib/i18n";
import { pageHref } from "@/lib/links";
import { useTripId } from "@/lib/use-trip-id";

// Miscellaneous: the to-do lists and the phrasebook, one card each. The
// phrasebook is a static page (it works offline), so it gets a plain link.
export function MiscScreen() {
  const tripId = useTripId();
  const items = useMiscItems();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{t("miscPage.title")}</h1>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const card: ReactNode = (
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-5 text-primary" aria-hidden />
                  {t(item.label)}
                </CardTitle>
                <CardDescription>{t(item.hint)}</CardDescription>
              </CardHeader>
            </Card>
          );
          return (
            <li key={item.key}>
              {"staticPath" in item ? (
                <a
                  href={`${BASE_PATH}${item.staticPath}`}
                  className="block h-full"
                >
                  {card}
                </a>
              ) : (
                <Link
                  href={pageHref(item.path, tripId)}
                  className="block h-full"
                >
                  {card}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
