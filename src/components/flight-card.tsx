"use client";

import { ArrowRight, Plane } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { FlightRecord } from "@/domain/schemas";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";

function Airport({
  code,
  city,
  date,
  time,
}: {
  code: string;
  city: string | null;
  date: string;
  time: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="font-semibold tabular-nums">
        {code} · {time}
      </span>
      {city && <span className="truncate text-muted-foreground">{city}</span>}
      <span className="text-xs text-muted-foreground">
        {formatDayLabel(date)}
      </span>
    </span>
  );
}

// One flight as printed on the ticket: times are local to each airport.
// `children` holds actions, such as editing it in Settings.
export function FlightCard({
  flight,
  children,
}: {
  flight: FlightRecord;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm">
      <div className="flex items-start gap-2">
        <Plane
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{flight.flightNumber}</span>{" "}
          <span className="text-muted-foreground">{flight.airline}</span>
        </span>
        {children}
      </div>
      <div className="flex items-start gap-2">
        <Airport
          code={flight.departAirport}
          city={flight.departCity}
          date={flight.departDate}
          time={flight.departTime}
        />
        <ArrowRight
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <Airport
          code={flight.arriveAirport}
          city={flight.arriveCity}
          date={flight.arriveDate}
          time={flight.arriveTime}
        />
      </div>
      {flight.confirmation && (
        <Badge variant="outline" className="select-all">
          {t("flights.confirmationCode", { code: flight.confirmation })}
        </Badge>
      )}
      {flight.note && <p className="text-muted-foreground">{flight.note}</p>}
    </div>
  );
}
