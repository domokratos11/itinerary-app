"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useSection, useSections } from "@/components/app-header";
import { Tip } from "@/components/tip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
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
  const sections = useSections();
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
              {sections.map(({ path: href, label, hint, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <Tip side="right" label={t(hint)}>
                    <SidebarMenuButton asChild isActive={section === href}>
                      <Link
                        href={pageHref(href, tripId)}
                        aria-current={section === href ? "page" : undefined}
                      >
                        <Icon />
                        <span>{t(label)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </Tip>
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
                            className="size-2 rounded-full not-dark:group-data-active/menu-button:ring-1 not-dark:group-data-active/menu-button:ring-white/80"
                            style={{
                              backgroundColor:
                                citiesById.get(id)?.color ?? "#64748b",
                            }}
                          />
                        ))}
                      </span>
                      <span className="flex-1 truncate">{label}</span>
                      {d.date === today && (
                        <span className="rounded bg-primary px-1.5 text-[10px] font-medium text-primary-foreground uppercase group-data-[collapsible=icon]:hidden not-dark:group-data-active/menu-button:bg-background not-dark:group-data-active/menu-button:text-primary">
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
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <CollapseButton />
      </SidebarFooter>
    </Sidebar>
  );
}

function CollapseButton() {
  const { open, toggleSidebar } = useSidebar();
  const label = open ? t("nav.collapse") : t("nav.expand");
  const Icon = open ? PanelLeftClose : PanelLeftOpen;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={label} onClick={toggleSidebar}>
          <Icon />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
