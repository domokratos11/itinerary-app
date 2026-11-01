"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  MapPinned,
  Settings,
  Wallet,
} from "lucide-react";

import { AccountSheet } from "@/components/account-sheet";
import { ActivitySheet } from "@/components/activity-sheet";
import { SearchPalette } from "@/components/search-palette";
import { Tip } from "@/components/tip";
import { TripSwitcher } from "@/components/trip-switcher";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/app-reset";
import { t } from "@/lib/i18n";
import { pageHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import { useTripId } from "@/lib/use-trip-id";

export const SECTIONS = [
  {
    path: "/",
    label: "nav.dashboard",
    hint: "nav.hintDashboard",
    icon: LayoutDashboard,
    match: ["/"],
  },
  {
    path: "/days/",
    label: "nav.days",
    hint: "nav.hintDays",
    icon: CalendarDays,
    match: ["/days/", "/day/"],
  },
  {
    path: "/cities/",
    label: "nav.cities",
    hint: "nav.hintCities",
    icon: MapPinned,
    match: ["/cities/", "/city/"],
  },
  {
    path: "/budget/",
    label: "nav.budget",
    hint: "nav.hintBudget",
    icon: Wallet,
    match: ["/budget/"],
  },
  {
    path: "/settings/",
    label: "nav.settings",
    hint: "nav.hintSettings",
    icon: Settings,
    match: ["/settings/"],
  },
] as const;

export function useSection(): string {
  // usePathname has no base path and may lack the trailing slash.
  const path = usePathname();
  const normal = path.endsWith("/") ? path : `${path}/`;
  return (
    SECTIONS.find((s) => (s.match as readonly string[]).includes(normal))
      ?.path ?? ""
  );
}

// The top bar on every page: the trip name, the sections (on wider
// screens), search, activity and the person's account. Phones get the sections as a tab
// bar at the bottom instead (BottomNav).
export function AppHeader() {
  const tripId = useTripId();
  const active = useSection();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 w-full items-center gap-2 px-4 lg:px-6">
        <TripSwitcher />
        <nav
          aria-label={t("nav.sections")}
          className="ml-4 hidden gap-1 md:flex lg:hidden"
        >
          {SECTIONS.map(({ path, label, hint, icon: Icon }) => (
            <Tip key={path} label={t(hint)}>
              <Button
                asChild
                variant={active === path ? "secondary" : "ghost"}
                size="sm"
              >
                <Link
                  href={pageHref(path, tripId)}
                  aria-current={active === path ? "page" : undefined}
                >
                  <Icon />
                  {t(label)}
                </Link>
              </Button>
            </Tip>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <SearchPalette />
          <ActivitySheet compact />
          <AccountSheet />
        </div>
      </div>
    </header>
  );
}

// Bottom right on wider screens. Phones find it in Settings, as the corner
// belongs to the tab bar there.
export function VersionTag() {
  return (
    <p className="pointer-events-none fixed right-2 bottom-1 z-30 hidden rounded bg-background/80 px-1.5 text-[11px] text-muted-foreground md:block">
      {t("common.version", { version: APP_VERSION })}
    </p>
  );
}

export function BottomNav() {
  const tripId = useTripId();
  const active = useSection();
  return (
    <nav
      aria-label={t("nav.sections")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {SECTIONS.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <Link
              href={pageHref(path, tripId)}
              aria-current={active === path ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 px-0.5 py-2 text-[11px] text-muted-foreground",
                active === path && "font-medium text-primary",
              )}
            >
              <Icon className="size-5" />
              <span className="max-w-full truncate">{t(label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
