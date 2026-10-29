"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AddToDay } from "@/components/add-to-day";
import type { Place } from "@/domain/schemas";
import { CATEGORY_LABEL } from "@/lib/category-label";
import { useMediaQuery } from "@/lib/use-media-query";

export type NearbyPlace = { id: string; name: string };

type Props = {
  place: Place | null;
  nearby: NearbyPlace[];
  onOpenChange: (open: boolean) => void;
};

// Phones get a bottom Drawer; wider screens get a side Sheet.
export function PlaceDetails({ place, nearby, onOpenChange }: Props) {
  const wide = useMediaQuery("(min-width: 768px)");
  const open = place !== null;

  if (wide) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          {place && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="text-xl">{place.name}</SheetTitle>
                <SheetDescription className="sr-only">
                  Place details
                </SheetDescription>
              </SheetHeader>
              <PlaceBody place={place} nearby={nearby} />
            </>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        {place && (
          <div className="overflow-y-auto px-4 pb-6">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle className="text-xl">{place.name}</DrawerTitle>
              <DrawerDescription className="sr-only">
                Place details
              </DrawerDescription>
            </DrawerHeader>
            <PlaceBody place={place} nearby={nearby} />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function PlaceBody({ place, nearby }: { place: Place; nearby: NearbyPlace[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{CATEGORY_LABEL[place.category]}</Badge>
        <Badge variant="outline" className="text-foreground">
          {place.priority}
        </Badge>
        {place.verifiedAt && (
          <Badge variant="outline">Checked {place.verifiedAt}</Badge>
        )}
      </div>

      <Button asChild>
        <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink />
          Open in Google Maps
        </a>
      </Button>
      <AddToDay place={place} />

      {place.purpose && <Section label="Why go">{place.purpose}</Section>}
      {place.description && (
        <Section label="About">{place.description}</Section>
      )}
      {place.tips.length > 0 && (
        <Section label="Tips">
          <ul className="list-disc pl-5">
            {place.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section label="Cost">{formatCost(place.costEstimateJPY)}</Section>
      <Section label="Time needed">
        {place.durationMin === null
          ? "Not researched yet"
          : `${place.durationMin} min`}
      </Section>
      <Section label="Opening hours">
        {place.openingHours ?? "Not researched yet"}
      </Section>
      {place.closedDates.length > 0 && (
        <Section label="Closed on">
          <div className="flex flex-wrap gap-1.5">
            {place.closedDates.map((d) => (
              <Badge key={d} variant="destructive">
                {d}
              </Badge>
            ))}
          </div>
        </Section>
      )}
      {place.seasonFrom && place.seasonTo && (
        <Section label="Season">
          {place.seasonFrom} to {place.seasonTo}
        </Section>
      )}
      {place.notes && <Section label="Notes">{place.notes}</Section>}
      {place.websiteUrl && (
        <Section label="Website">
          <a
            className="break-all underline"
            href={place.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {place.websiteUrl}
          </a>
        </Section>
      )}

      <Section label="Nearby saved places (within 1 km)">
        {nearby.length === 0 ? (
          "None"
        ) : (
          <ul className="list-disc pl-5">
            {nearby.map((n) => (
              <li key={n.id}>{n.name}</li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function formatCost(yen: number | null): string {
  if (yen === null) return "Not researched yet";
  if (yen === 0) return "Free";
  return `¥${yen.toLocaleString("en-US")}`;
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </h3>
      <div className="text-sm">{children}</div>
    </section>
  );
}
