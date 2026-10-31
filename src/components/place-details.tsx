"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink, Pencil, Search } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
import { PlaceEditor } from "@/components/place-editor";
import { mapsSearchUrl } from "@/domain/place-edit";
import { isOpenProposal } from "@/domain/proposals";
import type { PlaceRecord } from "@/domain/schemas";
import { isDraft } from "@/domain/queue";
import { CATEGORY_LABEL } from "@/lib/category-label";
import { pageHref } from "@/lib/links";
import { requestResearch } from "@/lib/proposal-actions";
import { useProposals } from "@/lib/use-proposals";
import { useMediaQuery } from "@/lib/use-media-query";
import { useTripId } from "@/lib/use-trip-id";

export type NearbyPlace = { id: string; name: string };

type Props = {
  place: PlaceRecord | null;
  nearby: NearbyPlace[];
  onOpenChange: (open: boolean) => void;
};

// Phones get a bottom Drawer; wider screens get a side Sheet.
export function PlaceDetails({ place, nearby, onOpenChange }: Props) {
  const wide = useMediaQuery("(min-width: 768px)");
  const tripId = useTripId();
  const [editing, setEditing] = useState<string | null>(null);
  // The details step aside while the editor is open, so two panels never
  // stack, and come back when it closes.
  const isEditing = place !== null && editing === place.id;
  const open = place !== null && !isEditing;
  const onEdit = tripId && place ? () => setEditing(place.id) : null;
  const editor = isEditing && tripId && (
    <PlaceEditor
      key={place.id}
      tripId={tripId}
      place={place}
      onClose={() => setEditing(null)}
    />
  );

  if (wide) {
    return (
      <>
        {editor}
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
                <PlaceBody place={place} nearby={nearby} onEdit={onEdit} />
              </>
            )}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {editor}
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
              <PlaceBody place={place} nearby={nearby} onEdit={onEdit} />
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

function PlaceBody({
  place,
  nearby,
  onEdit,
}: {
  place: PlaceRecord;
  nearby: NearbyPlace[];
  onEdit: (() => void) | null;
}) {
  const mapsLink = place.googlePlaceId
    ? mapsSearchUrl(place.name, place.googlePlaceId)
    : place.mapsUrl;
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
        <a href={mapsLink} target="_blank" rel="noopener noreferrer">
          <ExternalLink />
          Open in Google Maps
        </a>
      </Button>
      <AddToDay place={place} />
      {onEdit && (
        <Button variant="outline" onClick={onEdit}>
          <Pencil />
          Edit place
        </Button>
      )}
      <PlaceResearch place={place} />

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
      {place.nearestStation && (
        <Section label="Nearest station">
          {[
            place.nearestStation.name,
            place.nearestStation.lines.join(", "),
            place.nearestStation.walkMin !== null
              ? `${place.nearestStation.walkMin} min walk`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
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

// Asks for research on this place, or says where that has got to.
function PlaceResearch({ place }: { place: PlaceRecord }) {
  const tripId = useTripId();
  const proposals = useProposals(tripId);
  if (!tripId) return null;
  const open = proposals.find(
    (p) => p.placeId === place.id && isOpenProposal(p),
  );
  if (open?.status === "ready")
    return (
      <Link
        href={pageHref("/settings/", tripId, { tab: "places" })}
        className="text-sm underline"
      >
        Research is ready to review in Settings
      </Link>
    );
  if (open)
    return (
      <p className="text-sm text-muted-foreground">
        Research requested. It arrives after the next research run.
      </p>
    );
  return (
    <Button
      variant="outline"
      onClick={() =>
        requestResearch(tripId, [place], proposals).catch(() =>
          toast.error("That change was refused. Check the trip link."),
        )
      }
    >
      <Search />
      Research this place
    </Button>
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
