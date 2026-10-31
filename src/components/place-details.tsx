"use client";

import { useState, type ReactNode } from "react";
import { Archive, ExternalLink, Pencil, Search } from "lucide-react";
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
import { PlaceLive } from "@/components/place-live";
import { mapsSearchUrl } from "@/domain/place-edit";
import { isOpenProposal } from "@/domain/proposals";
import type { PlaceRecord } from "@/domain/schemas";
import { isDraft } from "@/domain/queue";
import { t } from "@/lib/i18n";
import { categoryLabel } from "@/lib/category-label";
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
  // True when a plan item uses the place; it can't be archived then.
  inPlan?: boolean;
  // Left out where archiving doesn't apply, such as a stop in a day's plan.
  onArchive?: (place: PlaceRecord) => void;
};

// Phones get a bottom Drawer; wider screens get a side Sheet.
export function PlaceDetails({
  place,
  nearby,
  inPlan = false,
  onOpenChange,
  onArchive,
}: Props) {
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
  const body = place && (
    <PlaceBody
      place={place}
      nearby={nearby}
      inPlan={inPlan}
      onEdit={onEdit}
      onArchive={onArchive ? () => onArchive(place) : null}
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
                    {t("place.details")}
                  </SheetDescription>
                </SheetHeader>
                {body}
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
                  {t("place.details")}
                </DrawerDescription>
              </DrawerHeader>
              {body}
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
  inPlan,
  onEdit,
  onArchive,
}: {
  place: PlaceRecord;
  nearby: NearbyPlace[];
  inPlan: boolean;
  onEdit: (() => void) | null;
  onArchive: (() => void) | null;
}) {
  const mapsLink = place.googlePlaceId
    ? mapsSearchUrl(place.name, place.googlePlaceId)
    : place.mapsUrl;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{categoryLabel(place.category)}</Badge>
        <Badge variant="outline" className="text-foreground">
          {t(`priorities.${place.priority}`)}
        </Badge>
        {isDraft(place) && (
          <Badge variant="outline" className="border-dashed">
            {t("common.notResearched")}
          </Badge>
        )}
        {place.verifiedAt && (
          <Badge variant="outline">
            {t("place.checked", { date: place.verifiedAt })}
          </Badge>
        )}
      </div>

      <Button asChild>
        <a href={mapsLink} target="_blank" rel="noopener noreferrer">
          <ExternalLink />
          {t("place.openInMaps")}
        </a>
      </Button>
      <AddToDay place={place} />
      {(onEdit || onArchive) && (
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" className="flex-1" onClick={onEdit}>
              <Pencil />
              {t("place.edit")}
            </Button>
          )}
          {onArchive && (
            <Button
              variant="outline"
              className="flex-1"
              disabled={inPlan}
              title={inPlan ? t("place.removeFromPlanFirst") : undefined}
              onClick={onArchive}
            >
              <Archive />
              {t("common.archive")}
            </Button>
          )}
        </div>
      )}
      {onArchive && inPlan && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {t("place.inPlanNote")}
        </p>
      )}
      <PlaceResearch place={place} />
      <PlaceLive key={place.id} place={place} />

      {place.purpose && (
        <Section label={t("common.whyGo")}>{place.purpose}</Section>
      )}
      {place.description && (
        <Section label={t("common.about")}>{place.description}</Section>
      )}
      {place.tips.length > 0 && (
        <Section label={t("common.tips")}>
          <ul className="list-disc pl-5">
            {place.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section label={t("common.cost")}>
        {formatCost(place.costEstimateJPY)}
      </Section>
      <Section label={t("common.timeNeeded")}>
        {place.durationMin === null
          ? t("common.notResearched")
          : t("common.minutes", { minutes: place.durationMin })}
      </Section>
      <Section label={t("common.openingHours")}>
        {place.openingHours ?? t("common.notResearched")}
      </Section>
      {place.closedDates.length > 0 && (
        <Section label={t("common.closedOn")}>
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
        <Section label={t("place.season")}>
          {t("place.seasonRange", {
            from: place.seasonFrom,
            to: place.seasonTo,
          })}
        </Section>
      )}
      {place.nearestStation && (
        <Section label={t("common.nearestStation")}>
          {[
            place.nearestStation.name,
            place.nearestStation.lines.join(", "),
            place.nearestStation.walkMin !== null
              ? t("common.minutesWalk", {
                  minutes: place.nearestStation.walkMin,
                })
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </Section>
      )}
      {place.notes && (
        <Section label={t("common.notes")}>{place.notes}</Section>
      )}
      {place.websiteUrl && (
        <Section label={t("common.website")}>
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

      <Section label={t("place.nearby")}>
        {nearby.length === 0 ? (
          t("common.none")
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
        {t("place.researchReady")}
      </Link>
    );
  if (open)
    return (
      <p className="text-sm text-muted-foreground">
        {t("place.researchPending")}
      </p>
    );
  return (
    <Button
      variant="outline"
      onClick={() =>
        requestResearch(tripId, [place], proposals).catch(() =>
          toast.error(t("common.refused")),
        )
      }
    >
      <Search />
      {t("place.research")}
    </Button>
  );
}

function formatCost(yen: number | null): string {
  if (yen === null) return t("common.notResearched");
  if (yen === 0) return t("common.free");
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
