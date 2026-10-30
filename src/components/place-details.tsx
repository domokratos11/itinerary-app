"use client";

import type { ReactNode } from "react";
import { Archive, ExternalLink, Pencil } from "lucide-react";

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
import type { PlaceRecord } from "@/domain/schemas";
import { isDraft } from "@/domain/queue";
import { CATEGORY_LABEL } from "@/lib/category-label";
import { useMediaQuery } from "@/lib/use-media-query";

export type NearbyPlace = { id: string; name: string };

type Props = {
  place: PlaceRecord | null;
  nearby: NearbyPlace[];
  // True when a plan item uses the place; it can't be archived then.
  inPlan: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (place: PlaceRecord) => void;
  onArchive: (place: PlaceRecord) => void;
};

// Phones get a bottom Drawer; wider screens get a side Sheet.
export function PlaceDetails({
  place,
  nearby,
  inPlan,
  onOpenChange,
  onEdit,
  onArchive,
}: Props) {
  const body = place && (
    <PlaceBody
      place={place}
      nearby={nearby}
      inPlan={inPlan}
      onEdit={() => onEdit(place)}
      onArchive={() => onArchive(place)}
    />
  );
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
              {body}
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
            {body}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function PlaceBody({
  place,
  nearby,
  inPlan,
  onEdit,
  onArchive,
}: {
  place: PlaceRecord;
  nearby: NearbyPlace[];
  inPlan: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{CATEGORY_LABEL[place.category]}</Badge>
        <Badge variant="outline" className="text-foreground">
          {place.priority}
        </Badge>
        {isDraft(place) && (
          <Badge variant="outline" className="border-dashed">
            Not researched yet
          </Badge>
        )}
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
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onEdit}>
          <Pencil />
          Edit
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={inPlan}
          title={inPlan ? "Remove it from the plan first" : undefined}
          onClick={onArchive}
        >
          <Archive />
          Archive
        </Button>
      </div>
      {inPlan && (
        <p className="-mt-2 text-xs text-muted-foreground">
          It&apos;s in the plan. Remove it from its day to archive it.
        </p>
      )}

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
