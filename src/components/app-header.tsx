"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Inbox, MapPinned, Settings } from "lucide-react";

import { ActivitySheet } from "@/components/activity-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { pageHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import { useTripId } from "@/lib/use-trip-id";

const SECTIONS = [
  { path: "/", label: "Days", icon: CalendarDays, match: ["/", "/day/"] },
  {
    path: "/cities/",
    label: "Cities",
    icon: MapPinned,
    match: ["/cities/", "/city/"],
  },
  { path: "/queue/", label: "Queue", icon: Inbox, match: ["/queue/"] },
  {
    path: "/settings/",
    label: "Settings",
    icon: Settings,
    match: ["/settings/"],
  },
] as const;

function useSection(): string {
  // usePathname has no base path and may lack the trailing slash.
  const path = usePathname();
  const normal = path.endsWith("/") ? path : `${path}/`;
  return (
    SECTIONS.find((s) => (s.match as readonly string[]).includes(normal))
      ?.path ?? ""
  );
}

// The top bar on every page: the trip name, the sections (on wider
// screens), search, activity and theme. Phones get the sections as a tab
// bar at the bottom instead (BottomNav).
export function AppHeader({ search }: { search?: React.ReactNode }) {
  const tripId = useTripId();
  const active = useSection();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
        <Link
          href={pageHref("/", tripId)}
          className="font-heading text-base font-semibold tracking-tight"
        >
          Japan Trip
        </Link>
        <nav aria-label="Sections" className="ml-4 hidden gap-1 md:flex">
          {SECTIONS.map(({ path, label, icon: Icon }) => (
            <Button
              key={path}
              asChild
              variant={active === path ? "secondary" : "ghost"}
              size="sm"
            >
              <Link
                href={pageHref(path, tripId)}
                aria-current={active === path ? "page" : undefined}
              >
                <Icon />
                {label}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {search}
          <ActivitySheet compact />
          <ThemeToggle compact />
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const tripId = useTripId();
  const active = useSection();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {SECTIONS.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <Link
              href={pageHref(path, tripId)}
              aria-current={active === path ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground",
                active === path && "font-medium text-primary",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
