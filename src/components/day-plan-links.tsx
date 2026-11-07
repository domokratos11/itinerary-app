"use client";

import { useMemo } from "react";
import { BedDouble, ExternalLink, Ticket } from "lucide-react";

import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { directionsUrl, legsForDay, placeLocation } from "@/domain/plan";
import type { PlanItem, Reservation } from "@/domain/schemas";
import type { Endpoint } from "@/domain/trip";
import { t } from "@/lib/i18n";
import { usePlacesById } from "@/lib/trip-store";

// The day page's links out (directions for the whole day and to the hotel)
// and its bookings.

// The day's bookings (flights, trains, tickets) from the trip settings.
export function Reservations({
  reservations,
}: {
  reservations: Reservation[];
}) {
  if (reservations.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground uppercase">
        {t("day.reservations")}
      </h2>
      {reservations.map((r, i) => (
        <Card key={`${r.type}-${i}`} size="sm">
          <CardContent className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t(`reservationType.${r.type}`)}</Badge>
              {r.time && <span className="font-medium">{r.time}</span>}
            </div>
            <div>
              {r.from && r.to ? `${r.from} → ${r.to}` : (r.from ?? r.to ?? "")}
            </div>
            {r.note && <div className="text-muted-foreground">{r.note}</div>}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

// Wide screens: the day's bookings behind a button, to leave room for the plan.
export function BookingsButton({
  reservations,
}: {
  reservations: Reservation[];
}) {
  if (reservations.length === 0) return null;
  return (
    <Sheet>
      <Tip label={t("day.tipBookings")}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <Ticket />
            {t("day.bookings", { count: reservations.length })}
          </Button>
        </SheetTrigger>
      </Tip>
      <SheetContent side="right">
        <SheetHeader className="text-left">
          <SheetTitle>{t("day.reservations")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("day.tipBookings")}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <Reservations reservations={reservations} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

// Directions to the day's hotel. Most days start and end at the same one, and
// that needs only one button.
export function HotelButtons({
  start,
  end,
}: {
  start: Endpoint | null;
  end: Endpoint | null;
}) {
  if (start && end && start.name === end.name)
    return <HotelButton text={start.name} endpoint={start} />;
  return (
    <>
      {start && (
        <HotelButton
          text={t("day.hotelEndpoint", {
            label: t("day.start"),
            name: start.name,
          })}
          endpoint={start}
        />
      )}
      {end && (
        <HotelButton
          text={t("day.hotelEndpoint", { label: t("day.end"), name: end.name })}
          endpoint={end}
        />
      )}
    </>
  );
}

function HotelButton({ text, endpoint }: { text: string; endpoint: Endpoint }) {
  const label = <span className="max-w-48 truncate">{text}</span>;
  if (!endpoint.location)
    return (
      <Button variant="outline" size="sm" disabled>
        <BedDouble />
        {label}
      </Button>
    );
  return (
    <Tip label={t("day.tipHotel", { name: endpoint.name })}>
      <Button asChild variant="outline" size="sm">
        <a
          href={directionsUrl(endpoint.location)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BedDouble />
          {label}
        </a>
      </Button>
    </Tip>
  );
}

export function FullDay({
  start,
  end,
  stops,
}: {
  start: Endpoint | null;
  end: Endpoint | null;
  stops: PlanItem[];
}) {
  const placesById = usePlacesById();
  const legs = useMemo(() => {
    if (!start?.location || !end?.location) return null;
    const points = stops.flatMap((item) => {
      const place = placesById.get(item.placeId);
      return place
        ? [{ name: place.name, location: placeLocation(place) }]
        : [];
    });
    return legsForDay({ name: start.name, location: start.location }, points, {
      name: end.name,
      location: end.location,
    });
  }, [start, end, stops, placesById]);

  return (
    <Sheet>
      <Tip label={t("day.tipFullDay")}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            {t("day.fullDay")}
          </Button>
        </SheetTrigger>
      </Tip>
      <SheetContent
        side="bottom"
        className="max-h-[80dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{t("day.fullDay")}</SheetTitle>
          <SheetDescription>{t("day.fullDayDescription")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="gap-2">
          {legs === null && (
            <p className="text-sm text-muted-foreground">
              {t("day.fullDayNeedsHotel")}
            </p>
          )}
          {legs?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("day.noStops")}</p>
          )}
          {legs?.map((leg) => (
            <a
              key={`${leg.from}-${leg.to}`}
              href={leg.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <span>
                {leg.from} → {leg.to}
              </span>
              <ExternalLink className="size-4 text-muted-foreground" />
            </a>
          ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
