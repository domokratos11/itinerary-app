"use client";

import { useState, type FormEvent } from "react";
import { Plus, SkipForward } from "lucide-react";
import { toast } from "sonner";

import { BudgetForm } from "@/components/budget-parts";
import { copySummary, type CopyDone } from "@/components/copy-itinerary";
import { Field } from "@/components/edit-panel";
import { CityForm, saveCity } from "@/components/settings-cities";
import { FlightFormPanel, saveFlight } from "@/components/settings-flights";
import {
  saveStay,
  StayForm,
  useStayPreview,
} from "@/components/settings-stays";
import { MembersSection } from "@/components/settings-trip";
import {
  AddedList,
  StepIntro,
  WizardActions,
  type StepNav,
} from "@/components/setup-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPTY_BUDGET, formatYen } from "@/domain/budget";
import { flightRoute } from "@/domain/flights";
import type { MessageKey } from "@/domain/i18n";
import { tripDatesOf } from "@/domain/schemas";
import { isStepFilled, type SetupInput, type SetupStep } from "@/domain/setup";
import type { TripSummary } from "@/domain/trip-repository";
import { logActivity } from "@/lib/activity-log";
import { formatDateRange, formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { tripRepository } from "@/lib/trip-repository-instance";
import {
  useCitiesById,
  useTrip,
  useTripDates,
  useTripStore,
} from "@/lib/trip-store";

// The setup wizard's steps. Each one saves as it goes, through the same
// forms and actions as Settings, so leaving halfway loses nothing.

type StepProps = { tripId: string; nav: StepNav; filled: boolean };

// A colour for each new city, so several added in a row don't all match.
const CITY_COLOURS = [
  "#0f766e",
  "#2563eb",
  "#c2410c",
  "#7c3aed",
  "#be123c",
  "#4d7c0f",
  "#a16207",
  "#0e7490",
];

const DETAILS_FORM = "setup-details";

// Name and dates: the only step that can't be skipped, as the days come
// from the dates. Next saves them first.
export function DetailsStep({
  tripId,
  trip,
  nav,
}: StepProps & { trip: TripSummary }) {
  const [name, setName] = useState(trip.name ?? "");
  const [start, setStart] = useState(trip.startDate ?? "");
  const [end, setEnd] = useState(trip.endDate ?? "");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();
  const dates = tripDatesOf({ startDate: start, endDate: end });
  const backwards = start !== "" && end !== "" && end < start;
  const problem: MessageKey | null =
    trimmed === ""
      ? "setup.nameRequired"
      : backwards
        ? "tripSettings.endBeforeStart"
        : dates === null
          ? "setup.datesRequired"
          : null;
  // An end before the start is said at once; the rest once Next is pressed.
  const shown = backwards ? "tripSettings.endBeforeStart" : tried && problem;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (problem || !dates) return;
    const renamed = trimmed !== (trip.name ?? "");
    const redated =
      dates.startDate !== trip.startDate || dates.endDate !== trip.endDate;
    if (!renamed && !redated) return nav.next();
    setSaving(true);
    try {
      await tripRepository.updateTrip(tripId, {
        name: trimmed,
        startDate: dates.startDate,
        endDate: dates.endDate,
      });
    } catch {
      setSaving(false);
      toast.error(t("common.refused"));
      return;
    }
    if (redated)
      logActivity(tripId, {
        kind: "settings",
        targetId: null,
        summary: t("activity.changedTripDates", {
          from: formatDayLabel(dates.startDate),
          to: formatDayLabel(dates.endDate),
        }),
      });
    nav.next();
  }

  return (
    <>
      <StepIntro step="details" hint={t("setup.detailsHint")} />
      <form
        id={DETAILS_FORM}
        onSubmit={(e) => void submit(e)}
        noValidate
        className="flex max-w-xl flex-col gap-4"
      >
        <Field label={t("common.name")} htmlFor="setup-name">
          <Input
            id="setup-name"
            value={name}
            maxLength={100}
            aria-required
            aria-invalid={(tried && trimmed === "") || undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("tripSettings.startDate")} htmlFor="setup-start">
            <Input
              id="setup-start"
              type="date"
              value={start}
              aria-required
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label={t("tripSettings.endDate")} htmlFor="setup-end">
            <Input
              id="setup-end"
              type="date"
              value={end}
              min={start || undefined}
              aria-required
              aria-invalid={backwards || undefined}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
        {shown && (
          <p role="alert" className="text-sm text-destructive">
            {t(shown)}
          </p>
        )}
      </form>
      <WizardActions nav={nav} filled form={DETAILS_FORM} busy={saving} />
    </>
  );
}

export function CitiesStep({ tripId, nav, filled }: StepProps) {
  const { cities } = useTrip();
  const all = useTripStore((s) => s.data.cities);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <StepIntro step="cities" hint={t("setup.citiesHint")} />
      <AddedList
        empty={t("setup.noCities")}
        items={cities.map((c) => ({ id: c.id, title: c.name, color: c.color }))}
      />
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => setAdding(true)}
      >
        <Plus />
        {t("citySettings.add")}
      </Button>
      {adding && (
        <CityForm
          city={null}
          defaultColor={CITY_COLOURS[all.length % CITY_COLOURS.length]}
          onCancel={() => setAdding(false)}
          onSave={(name, color) => {
            saveCity(tripId, all, null, name, color);
            setAdding(false);
          }}
        />
      )}
      <WizardActions nav={nav} filled={filled} />
    </>
  );
}

// Each new hotel starts where the last one ends (or on the first day) and
// runs to the trip's last day. "To be decided" stays possible as a name.
export function HotelsStep({ tripId, nav, filled }: StepProps) {
  const trip = useTrip();
  const all = useTripStore((s) => s.data.stays);
  const citiesById = useCitiesById();
  const dates = useTripDates();
  const preview = useStayPreview();
  const [adding, setAdding] = useState(false);
  const checkIn = trip.stays.at(-1)?.checkOut ?? dates?.startDate ?? "";
  const checkOut = dates && dates.endDate > checkIn ? dates.endDate : "";

  return (
    <>
      <StepIntro step="hotels" hint={t("setup.hotelsHint")} />
      <AddedList
        empty={t("setup.noHotels")}
        items={trip.stays.map((s) => ({
          id: s.id,
          title: s.hotelName,
          color: citiesById.get(s.cityId)?.color,
          detail: `${citiesById.get(s.cityId)?.name ?? s.cityId} · ${formatDayLabel(s.checkIn)} → ${formatDayLabel(s.checkOut)}`,
        }))}
      />
      {trip.cities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("setup.hotelsNeedCity")}
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          <Plus />
          {t("common.addStay")}
        </Button>
      )}
      {adding && (
        <StayForm
          stay={null}
          takenIds={all.map((s) => s.id)}
          defaultCheckIn={checkIn}
          defaultCheckOut={checkOut}
          preview={(next) => preview(next, null)}
          onCancel={() => setAdding(false)}
          onSave={(record) => {
            saveStay(tripId, record);
            setAdding(false);
          }}
        />
      )}
      <WizardActions nav={nav} filled={filled} />
    </>
  );
}

export function FlightsStep({ tripId, nav, filled }: StepProps) {
  const { flights } = useTrip();
  const all = useTripStore((s) => s.data.flights);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <StepIntro step="flights" hint={t("setup.flightsHint")} />
      <AddedList
        empty={t("flights.none")}
        items={flights.map((f) => ({
          id: f.id,
          title: `${f.flightNumber} · ${flightRoute(f)}`,
          detail: `${formatDayLabel(f.departDate)} · ${f.departTime}`,
        }))}
      />
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => setAdding(true)}
      >
        <Plus />
        {t("flights.add")}
      </Button>
      {adding && (
        <FlightFormPanel
          flight={null}
          takenIds={all.map((f) => f.id)}
          onCancel={() => setAdding(false)}
          onSave={(record) => {
            saveFlight(tripId, record);
            setAdding(false);
          }}
        />
      )}
      <WizardActions nav={nav} filled={filled} />
    </>
  );
}

// Members, as in Settings → Trip, and the budget's total and travellers
// through the Budget screen's own form.
export function PeopleStep({
  tripId,
  trip,
  nav,
  filled,
}: StepProps & { trip: TripSummary }) {
  const [editing, setEditing] = useState(false);
  const budget = trip.budget ?? EMPTY_BUDGET;

  return (
    <>
      <StepIntro step="people" hint={t("setup.peopleHint")} />
      <div className="grid grid-cols-1 gap-6 text-sm lg:grid-cols-2">
        <MembersSection tripId={tripId} />
        <section className="flex flex-col gap-3">
          <h3 className="font-medium">{t("setup.budget")}</h3>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            <li>
              {budget.totalJPY === null
                ? t("budget.notSet")
                : t("setup.budgetTotal", { total: formatYen(budget.totalJPY) })}
            </li>
            {budget.travellers !== null && (
              <li>
                {t("setup.budgetTravellers", { count: budget.travellers })}
              </li>
            )}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => setEditing(true)}
          >
            {t("budget.setBudget")}
          </Button>
        </section>
      </div>
      {editing && (
        <BudgetForm
          tripId={tripId}
          budget={budget}
          onClose={() => setEditing(false)}
        />
      )}
      <WizardActions nav={nav} filled={filled} />
    </>
  );
}

// What is set and what was skipped, then "Open itinerary".
export function SummaryStep({
  input,
  steps,
  copied = null,
  nav,
  onOpen,
}: {
  input: SetupInput;
  steps: readonly SetupStep[];
  // What a copy from another itinerary brought in this visit.
  copied?: CopyDone | null;
  nav: StepNav;
  onOpen: () => void;
}) {
  const { trip, data } = input;
  const budget = trip.budget ?? EMPTY_BUDGET;
  const value: Partial<Record<SetupStep, string>> = {
    details: [
      trip.name ?? t("common.myTrip"),
      trip.startDate && trip.endDate
        ? formatDateRange(trip.startDate, trip.endDate)
        : t("setup.noDates"),
    ].join(" · "),
    ...(copied && { startFrom: copySummary(copied) }),
    cities: t("setup.countCities", { count: data.cities.length }),
    hotels: t("setup.countHotels", { count: data.stays.length }),
    flights: t("setup.countFlights", { count: data.flights.length }),
    people: [
      t("setup.countMembers", { count: trip.members.length }),
      ...(budget.totalJPY === null
        ? []
        : [t("setup.budgetTotal", { total: formatYen(budget.totalJPY) })]),
    ].join(" · "),
  };
  // "Start from" shows only after a copy in this visit, with what it brought.
  const rows = steps.filter((step) => value[step] !== undefined);

  return (
    <>
      <StepIntro step="summary" hint={t("setup.summaryHint")} />
      <dl className="flex flex-col divide-y rounded-lg border text-sm">
        {rows.map((step) => {
          const skipped =
            step !== "details" &&
            !(step === "startFrom" && copied) &&
            !isStepFilled(step, input);
          return (
            <div
              key={step}
              className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <dt className="font-medium sm:w-48 sm:shrink-0">
                {t(`setup.step.${step}`)}
              </dt>
              <dd
                className={
                  skipped
                    ? "flex items-center gap-1.5 text-muted-foreground"
                    : "min-w-0"
                }
              >
                {skipped ? (
                  <>
                    <SkipForward aria-hidden className="size-4" />
                    {t("setup.skipped")}
                  </>
                ) : (
                  value[step]
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <WizardActions
        nav={nav}
        filled
        onNext={onOpen}
        nextLabel={t("setup.open")}
      />
    </>
  );
}
