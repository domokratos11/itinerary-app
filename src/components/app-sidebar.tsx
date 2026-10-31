"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";

import { SECTIONS, useSection } from "@/components/app-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_VERSION } from "@/lib/app-reset";
import { formatDayLabel } from "@/lib/format-day";
import { dayHref, pageHref } from "@/lib/links";
import { usePlanStore } from "@/lib/plan-store";
import { todayInTokyo } from "@/lib/tokyo-date";
import { useCitiesById, useTripDays } from "@/lib/trip-store";
import { cn } from "@/lib/utils";
import { useTripId } from "@/lib/use-trip-id";

const noopSubscribe = () => () => {};

// Wide screens (1024px and up): the sections and every day of the trip,
// always in reach. Phones and tablets use the header and tab bar instead.
export function AppSidebar() {
  const tripId = useTripId();
  const section = useSection();
  const path = usePathname();
  const date = useSearchParams().get("date");
  const days = useTripDays();
  const citiesById = useCitiesById();
  const items = usePlanStore((s) => s.items);
  const today = useSyncExternalStore(noopSubscribe, todayInTokyo, () => null);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of items)
      if (i.status !== "removed") c.set(i.date, (c.get(i.date) ?? 0) + 1);
    return c;
  }, [items]);
  const onDay = path.startsWith("/day");

  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] border-r bg-sidebar text-sidebar-foreground lg:block">
      <ScrollArea className="h-full">
        <nav aria-label="Sections" className="flex flex-col gap-0.5 p-3">
          {SECTIONS.map(({ path: href, label, icon: Icon }) => (
            <Link
              key={href}
              href={pageHref(href, tripId)}
              aria-current={section === href ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                section === href &&
                  "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-6">
          <h2 className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Days
          </h2>
          <ol className="flex flex-col">
            {days.map((d) => {
              const active = onDay && d.date === date;
              const stops = counts.get(d.date) ?? 0;
              return (
                <li key={d.date}>
                  <Link
                    href={dayHref(d.date, tripId)}
                    prefetch={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                      active &&
                        "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                    )}
                  >
                    <span className="flex shrink-0 gap-0.5" aria-hidden>
                      {d.cityIds.map((id) => (
                        <span
                          key={id}
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor:
                              citiesById.get(id)?.color ?? "#64748b",
                          }}
                        />
                      ))}
                    </span>
                    <span className="flex-1 truncate">
                      {formatDayLabel(d.date)}
                    </span>
                    {d.date === today && (
                      <span className="rounded bg-primary px-1.5 text-[10px] font-medium text-primary-foreground uppercase">
                        Today
                      </span>
                    )}
                    {stops > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {stops}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="px-3 pt-4 text-xs text-muted-foreground">
            Version {APP_VERSION}
          </p>
        </div>
      </ScrollArea>
    </aside>
  );
}
