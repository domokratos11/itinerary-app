"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { SECTIONS, useSection } from "@/components/app-header";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import { APP_VERSION } from "@/lib/app-reset";
import { formatDayLabel } from "@/lib/format-day";
import { dayHref, pageHref } from "@/lib/links";
import { usePlanStore } from "@/lib/plan-store";
import { todayInTokyo } from "@/lib/tokyo-date";
import { useCitiesById, useTripDays } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

const noopSubscribe = () => () => {};

const OPEN_KEY = "sidebar-open";

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

// Remembers on this device whether the sidebar is expanded. It only renders
// inside AppGate, in the browser, so localStorage is there on the first render.
export function AppSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(readOpen);
  return (
    <TooltipProvider>
      <SidebarProvider
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          try {
            localStorage.setItem(OPEN_KEY, String(next));
          } catch {
            // Blocked storage: it stays as chosen until the page reloads.
          }
        }}
        className="min-h-0 flex-1 flex-col"
      >
        {children}
      </SidebarProvider>
    </TooltipProvider>
  );
}

// Wide screens (1024px and up): the sections and every day of the trip, which
// shrink to a rail of icons for more room. Phones and tablets use the header
// and tab bar instead.
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
  const onDay = path.startsWith("/day/") || path === "/day";

  return (
    <Sidebar collapsible="icon" className="top-14! h-[calc(100svh-3.5rem)]!">
      <SidebarContent>
        <SidebarGroup>
          <nav aria-label={t("nav.sections")}>
            <SidebarMenu>
              {SECTIONS.map(({ path: href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={section === href}
                    tooltip={t(label)}
                  >
                    <Link
                      href={pageHref(href, tripId)}
                      aria-current={section === href ? "page" : undefined}
                    >
                      <Icon />
                      <span>{t(label)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-wide uppercase">
            {t("nav.days")}
          </SidebarGroupLabel>
          <SidebarMenu>
            {days.map((d) => {
              const active = onDay && d.date === date;
              const stops = counts.get(d.date) ?? 0;
              const label = formatDayLabel(d.date);
              return (
                <SidebarMenuItem key={d.date}>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    isActive={active}
                    tooltip={label}
                  >
                    <Link
                      href={dayHref(d.date, tripId)}
                      prefetch={false}
                      aria-current={active ? "page" : undefined}
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
                      <span className="flex-1 truncate">{label}</span>
                      {d.date === today && (
                        <span className="rounded bg-primary px-1.5 text-[10px] font-medium text-primary-foreground uppercase group-data-[collapsible=icon]:hidden">
                          {t("common.today")}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                  {stops > 0 && d.date !== today && (
                    <SidebarMenuBadge>{stops}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          <p className="px-2 pt-4 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            {t("common.version", { version: APP_VERSION })}
          </p>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
