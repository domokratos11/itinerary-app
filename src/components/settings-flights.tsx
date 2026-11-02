"use client";

import { useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { LogCostButton } from "@/components/expense-form";
import { FlightCard } from "@/components/flight-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  flightCostInYen,
  flightCostLabel,
  flightFromForm,
  flightRoute,
  flightToForm,
  type FlightForm,
} from "@/domain/flights";
import {
  FLIGHT_CURRENCIES,
  type FlightCurrency,
  type FlightRecord,
} from "@/domain/schemas";
import { uniqueId } from "@/domain/trip-edit";
import { t } from "@/lib/i18n";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip, useTripStore } from "@/lib/trip-store";

type Editing = { record: FlightRecord | null } | null;

// Settings → Flights. Each one also shows on the days it leaves and lands.
export function FlightsSettings({ tripId }: { tripId: string }) {
  const { flights } = useTrip();
  const all = useTripStore((s) => s.data.flights);
  const [editing, setEditing] = useState<Editing>(null);

  function save(record: FlightRecord) {
    saveRecord(
      tripId,
      "flights",
      record,
      t("activity.savedFlight", { flight: record.flightNumber }),
    ).catch(() => toast.error(t("common.refused")));
    setEditing(null);
  }

  function archive(flight: FlightRecord) {
    archiveRecord(
      tripId,
      "flights",
      flight,
      t("activity.archivedFlight", { flight: flight.flightNumber }),
    ).catch(() => toast.error(t("common.refused")));
    toast(t("flights.archived"), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(
            tripId,
            "flights",
            flight,
            t("activity.restoredFlight", { flight: flight.flightNumber }),
          ).catch(() => toast.error(t("common.refused"))),
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {flights.map((flight) => {
          const cost = flightCostLabel(flight);
          const yen = flightCostInYen(flight);
          return (
            <li key={flight.id} className="flex flex-col gap-1">
              <FlightCard flight={flight}>
                <LogCostButton
                  tripId={tripId}
                  prefill={{
                    title: `${flight.flightNumber} · ${flightRoute(flight)}`,
                    category: "flight",
                    date: flight.departDate,
                    ...(yen !== null && { amountJPY: yen }),
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("flights.edit", {
                    flight: flight.flightNumber,
                  })}
                  onClick={() => setEditing({ record: flight })}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("flights.archiveAria", {
                    flight: flight.flightNumber,
                  })}
                  onClick={() => archive(flight)}
                >
                  <Archive />
                </Button>
              </FlightCard>
              {cost && (
                <p className="px-1 text-xs text-muted-foreground">
                  {t("flights.costLine", { cost })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {flights.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("flights.none")}</p>
      )}
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setEditing({ record: null })}
      >
        <Plus />
        {t("flights.add")}
      </Button>
      {editing && (
        <FlightFormPanel
          key={editing.record?.id ?? "new"}
          flight={editing.record}
          takenIds={all.map((f) => f.id)}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function FlightFormPanel({
  flight,
  takenIds,
  onCancel,
  onSave,
}: {
  flight: FlightRecord | null;
  takenIds: string[];
  onCancel: () => void;
  onSave: (record: FlightRecord) => void;
}) {
  const [form, setForm] = useState<FlightForm>(() => flightToForm(flight));
  const id =
    flight?.id ?? uniqueId(`${form.flightNumber}-${form.departDate}`, takenIds);
  const record = flightFromForm(form, id, new Date());

  const text = (field: keyof FlightForm) => ({
    value: form[field],
    onChange: (e: { target: { value: string } }) =>
      setForm({ ...form, [field]: e.target.value }),
  });

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={
        flight
          ? t("flights.edit", { flight: flight.flightNumber })
          : t("flights.add")
      }
      description={t("flights.localTimes")}
      canSubmit={record !== null}
      onSubmit={() => record && onSave(record)}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("flights.airline")} htmlFor="flight-airline">
          <Input id="flight-airline" maxLength={100} {...text("airline")} />
        </Field>
        <Field label={t("flights.number")} htmlFor="flight-number">
          <Input id="flight-number" maxLength={20} {...text("flightNumber")} />
        </Field>
      </div>
      <h3 className="text-sm font-medium">{t("flights.departure")}</h3>
      <AirportFields prefix="depart" text={text} />
      <h3 className="text-sm font-medium">{t("flights.arrival")}</h3>
      <AirportFields prefix="arrive" text={text} />
      <Field
        label={t("flights.confirmation")}
        htmlFor="flight-confirmation"
        hint={t("stays.privateHint")}
      >
        <Input
          id="flight-confirmation"
          maxLength={40}
          {...text("confirmation")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("flights.cost")} htmlFor="flight-cost">
          <Input
            id="flight-cost"
            inputMode="decimal"
            aria-invalid={
              form.costAmount !== "" && record === null ? true : undefined
            }
            {...text("costAmount")}
          />
        </Field>
        <Field label={t("flights.currency")} htmlFor="flight-currency">
          <Select
            value={form.costCurrency}
            onValueChange={(v) =>
              setForm({ ...form, costCurrency: v as FlightCurrency })
            }
          >
            <SelectTrigger id="flight-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FLIGHT_CURRENCIES.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label={t("common.noteOptional")} htmlFor="flight-note">
        <Textarea id="flight-note" maxLength={500} {...text("note")} />
      </Field>
    </EditPanel>
  );
}

function AirportFields({
  prefix,
  text,
}: {
  prefix: "depart" | "arrive";
  text: (field: keyof FlightForm) => {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
  };
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.date")} htmlFor={`${prefix}-date`}>
          <Input id={`${prefix}-date`} type="date" {...text(`${prefix}Date`)} />
        </Field>
        <Field label={t("flights.time")} htmlFor={`${prefix}-time`}>
          <Input id={`${prefix}-time`} type="time" {...text(`${prefix}Time`)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("flights.airport")}
          htmlFor={`${prefix}-airport`}
          hint={t("flights.airportHint")}
        >
          <Input
            id={`${prefix}-airport`}
            maxLength={3}
            autoCapitalize="characters"
            {...text(`${prefix}Airport`)}
          />
        </Field>
        <Field label={t("flights.city")} htmlFor={`${prefix}-city`}>
          <Input
            id={`${prefix}-city`}
            maxLength={100}
            {...text(`${prefix}City`)}
          />
        </Field>
      </div>
    </>
  );
}
