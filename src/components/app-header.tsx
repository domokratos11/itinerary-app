"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Eye,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  Settings,
  Wallet,
} from "lucide-react";

import { AccountSheet } from "@/components/account-sheet";
import { ActivitySheet } from "@/components/activity-sheet";
import { SearchPalette } from "@/components/search-palette";
import { SyncStatus } from "@/components/sync-status";
import { Tip } from "@/components/tip";
import { TripSwitcher } from "@/components/trip-switcher";
import { ViewerSheet } from "@/components/viewer";
import { WhatsNewButton } from "@/components/whats-new";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/app-reset";
import { t } from "@/lib/i18n";
import { pageHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import { useTripId } from "@/lib/use-trip-id";
import { useReadOnly } from "@/lib/viewer-store";

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
    path: "/todos/",
    label: "nav.todos",
    hint: "nav.hintTodos",
    icon: ListChecks,
    match: ["/todos/"],
  },
  {
    path: "/settings/",
    label: "nav.settings",
    hint: "nav.hintSettings",
    icon: Settings,
    match: ["/settings/"],
  },
] as const;

// What a read-only link may open: no money (Budget), no to-dos and no
// Settings.
const VIEWER_SECTIONS = SECTIONS.filter(
  (s) =>
    s.path !== "/budget/" && s.path !== "/todos/" && s.path !== "/settings/",
);

export function useSections(): readonly (typeof SECTIONS)[number][] {
  return useReadOnly() ? VIEWER_SECTIONS : SECTIONS;
}

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
  const sections = useSections();
  const readOnly = useReadOnly();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 w-full items-center gap-2 px-4 lg:px-6">
        <TripSwitcher />
        {readOnly && (
          <Badge variant="secondary" className="shrink-0">
            <Eye aria-hidden />
            {t("share.readOnly")}
          </Badge>
        )}
        <nav
          aria-label={t("nav.sections")}
          className="ml-4 hidden gap-1 md:flex lg:hidden"
        >
          {sections.map(({ path, label, hint, icon: Icon }) => (
            <Tip key={path} label={t(hint)}>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  active === path &&
                    "bg-accent font-semibold text-primary hover:bg-accent hover:text-primary",
                )}
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
          {!readOnly && <SyncStatus />}
          <SearchPalette />
          {readOnly ? (
            <ViewerSheet />
          ) : (
            <>
              <ActivitySheet compact />
              <AccountSheet />
            </>
          )}
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
      <WhatsNewButton className="pointer-events-auto">
        {t("common.version", { version: APP_VERSION })}
      </WhatsNewButton>
    </p>
  );
}

export function BottomNav() {
  const tripId = useTripId();
  const active = useSection();
  const sections = useSections();
  return (
    <nav
      aria-label={t("nav.sections")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul
        className={cn(
          "grid",
          sections.length === SECTIONS.length ? "grid-cols-6" : "grid-cols-3",
        )}
      >
        {sections.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <Link
              href={pageHref(path, tripId)}
              aria-current={active === path ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[11px] text-muted-foreground",
                active === path && "font-semibold text-primary",
              )}
            >
              {/* The pill behind the icon marks the open section, so it reads
                  at a glance without relying on the text colour alone. */}
              <span
                className={cn(
                  "flex h-7 w-11 items-center justify-center rounded-full",
                  active === path && "bg-accent",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="max-w-full truncate">{t(label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
