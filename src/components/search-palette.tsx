"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarDays, MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { dayHref, pageHref } from "@/lib/links";
import { useCitiesById, useTrip, useTripDays } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";

// Search everything: days, places and hotels. Ctrl+K (or ⌘K) opens it on
// desktop; phones use the search button in the header.
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const tripId = useTripId();
  const trip = useTrip();
  const days = useTripDays();
  const citiesById = useCitiesById();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const cityName = (id: string) => citiesById.get(id)?.name ?? id;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t("search.title")}
        className="text-muted-foreground"
      >
        <Search />
        <span className="hidden lg:inline">{t("search.title")}</span>
        <kbd className="hidden rounded border px-1 text-[10px] lg:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("search.title")}
        description={t("search.description")}
      >
        <Command>
          <CommandInput placeholder={t("search.placeholder")} />
          <CommandList>
            <CommandEmpty>{t("search.nothing")}</CommandEmpty>
            <CommandGroup heading={t("search.days")}>
              {days.map((d) => {
                const label = formatDayLabel(d.date);
                const cities = d.cityIds.map(cityName).join(" → ");
                return (
                  <CommandItem
                    key={d.date}
                    value={`${label} ${d.date} ${cities}`}
                    onSelect={() => go(dayHref(d.date, tripId))}
                  >
                    <CalendarDays />
                    {label}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {cities}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandGroup heading={t("search.hotels")}>
              {trip.stays.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.hotelName} ${cityName(s.cityId)} hotel`}
                  onSelect={() => go(dayHref(s.checkIn, tripId))}
                >
                  <BedDouble />
                  {s.hotelName}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDayLabel(s.checkIn)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={t("search.places")}>
              {trip.places.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${cityName(p.cityId)} ${p.category}`}
                  onSelect={() =>
                    go(
                      pageHref("/city/", tripId, { id: p.cityId, place: p.id }),
                    )
                  }
                >
                  <MapPin />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {cityName(p.cityId)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
