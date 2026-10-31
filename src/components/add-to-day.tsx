"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { itemsForDay } from "@/domain/plan";
import type { Place } from "@/domain/schemas";
import { addPlaceToDay } from "@/lib/plan-actions";
import { usePlanStore } from "@/lib/plan-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { useCitiesById, useTripDays } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";
import { formatDayLabel } from "@/lib/format-day";

// "Add to day": a bottom Drawer on phones, a command palette on wider screens.
export function AddToDay({ place }: { place: Place }) {
  const [open, setOpen] = useState(false);
  const wide = useMediaQuery("(min-width: 768px)");
  const tripId = useTripId();
  const items = usePlanStore((s) => s.items);
  const tripDays = useTripDays();
  const citiesById = useCitiesById();
  // Days where this place's city is staying (transfer days included).
  const days = useMemo(
    () => tripDays.filter((d) => d.cityIds.includes(place.cityId)),
    [tripDays, place.cityId],
  );

  function pick(date: string) {
    setOpen(false);
    if (!tripId) return;
    // Not awaited: the local cache applies the change at once, and the save
    // completes later when online. Only a refused write is reported.
    addPlaceToDay(tripId, place.id, date, itemsForDay(items, date)).catch(() =>
      toast.error("That change was refused. Check the trip link."),
    );
    toast.success(`Added ${place.name} to ${formatDayLabel(date)}`);
  }

  const list = (
    <Command>
      <CommandList>
        <CommandEmpty>No days for this city.</CommandEmpty>
        <CommandGroup
          heading={`Days in ${citiesById.get(place.cityId)?.name ?? place.cityId}`}
        >
          {days.map((day) => (
            <CommandItem
              key={day.date}
              value={day.date}
              onSelect={() => pick(day.date)}
            >
              {formatDayLabel(day.date)}
              <span className="ml-auto text-muted-foreground">
                {itemsForDay(items, day.date).length} stops
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}>
        Add to day
      </Button>
      {wide ? (
        <CommandDialog
          open={open}
          onOpenChange={setOpen}
          title="Add to day"
          description={`Choose a day for ${place.name}`}
        >
          {list}
        </CommandDialog>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[70vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Add to day</DrawerTitle>
              <DrawerDescription>
                Choose a day for {place.name}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-2 pb-6">{list}</div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
