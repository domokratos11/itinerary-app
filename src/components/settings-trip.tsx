"use client";

import { useState, type FormEvent } from "react";
import { CalendarRange, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/edit-panel";
import { ChangePreview } from "@/components/settings-stays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tripDatesOf, type TripDates } from "@/domain/schemas";
import { dayChanges, memberEmail } from "@/domain/trip-edit";
import { t } from "@/lib/i18n";
import { logActivity } from "@/lib/activity-log";
import { useActiveTrip, useAuthStore } from "@/lib/auth-store";
import { formatDayLabel } from "@/lib/format-day";
import { usePlanStore } from "@/lib/plan-store";
import { tripRepository } from "@/lib/trip-repository-instance";
import { useTrip, useTripDates } from "@/lib/trip-store";

// The trip's own first and last day. Its days are these plus whatever the
// hotels cover, so a trip can have days before any hotel is booked. Saving
// says first which days come or go, and how many stops would need a new day.
function TripDatesForm({
  tripId,
  saved,
}: {
  tripId: string;
  saved: TripDates | null;
}) {
  const trip = useTrip();
  const items = usePlanStore((s) => s.items);
  const [start, setStart] = useState(saved?.startDate ?? "");
  const [end, setEnd] = useState(saved?.endDate ?? "");
  // Both empty clears the dates; one alone or an end before the start can't
  // be saved (undefined).
  const cleared = start === "" && end === "";
  const next: TripDates | null | undefined = cleared
    ? null
    : (tripDatesOf({ startDate: start, endDate: end }) ?? undefined);
  const backwards = start !== "" && end !== "" && end < start;
  const changed =
    next !== undefined &&
    ((next?.startDate ?? null) !== (saved?.startDate ?? null) ||
      (next?.endDate ?? null) !== (saved?.endDate ?? null));
  const preview =
    next !== undefined && changed
      ? dayChanges(trip.stays, trip.stays, items, trip.places, saved, next)
      : null;

  function save(range: TripDates | null) {
    tripRepository
      .updateTrip(
        tripId,
        range
          ? { startDate: range.startDate, endDate: range.endDate }
          : { startDate: null, endDate: null },
      )
      .then(() =>
        logActivity(tripId, {
          kind: "settings",
          targetId: null,
          summary: range
            ? t("activity.changedTripDates", {
                from: formatDayLabel(range.startDate),
                to: formatDayLabel(range.endDate),
              })
            : t("activity.clearedTripDates"),
        }),
      )
      .catch(() => toast.error(t("common.refused")));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (next !== undefined && changed) save(next);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 font-medium">
        <CalendarRange aria-hidden className="size-4 text-muted-foreground" />
        {t("tripSettings.dates")}
      </h3>
      <p className="text-muted-foreground">{t("tripSettings.datesHint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("tripSettings.startDate")} htmlFor="trip-start">
          <Input
            id="trip-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label={t("tripSettings.endDate")} htmlFor="trip-end">
          <Input
            id="trip-end"
            type="date"
            value={end}
            min={start || undefined}
            aria-invalid={backwards || undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
      {backwards && (
        <p role="alert" className="text-destructive">
          {t("tripSettings.endBeforeStart")}
        </p>
      )}
      {preview && <ChangePreview changes={preview} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={!changed}>
          {t("tripSettings.saveDates")}
        </Button>
        {!cleared && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStart("");
              setEnd("");
            }}
          >
            {t("tripSettings.clearDates")}
          </Button>
        )}
      </div>
    </form>
  );
}

// The trip itself: its name and who is on it. Anyone on the trip can change
// these; the rules keep them from removing themselves.
export function TripSettings({ tripId }: { tripId: string }) {
  const trip = useActiveTrip();
  const savedRange = useTripDates();
  const me = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);
  const [name, setName] = useState(trip?.name ?? "");
  const [email, setEmail] = useState("");
  const members = trip?.members ?? [];
  const trimmed = name.trim();
  const added = memberEmail(email);

  function saveName(event: FormEvent) {
    event.preventDefault();
    tripRepository
      .updateTrip(tripId, { name: trimmed })
      .then(() =>
        logActivity(tripId, {
          kind: "settings",
          targetId: null,
          summary: t("activity.renamedTrip", { name: trimmed }),
        }),
      )
      .catch(() => toast.error(t("common.refused")));
  }

  function saveMembers(next: string[]) {
    tripRepository
      .updateTrip(tripId, { members: next })
      .then(() =>
        logActivity(tripId, {
          kind: "settings",
          targetId: null,
          summary: t("activity.changedMembers"),
        }),
      )
      .catch(() => toast.error(t("common.refused")));
  }

  function addMember(event: FormEvent) {
    event.preventDefault();
    if (!added) return;
    setEmail("");
    if (!members.includes(added)) saveMembers([...members, added]);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6 text-sm">
      <TripDatesForm
        key={`${savedRange?.startDate ?? ""}-${savedRange?.endDate ?? ""}`}
        tripId={tripId}
        saved={savedRange}
      />
      <form onSubmit={saveName} className="flex flex-col gap-3">
        <Field label={t("tripSettings.tripName")} htmlFor="trip-name">
          <Input
            id="trip-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Button
          type="submit"
          variant="outline"
          className="self-start"
          disabled={trimmed.length === 0 || trimmed === trip?.name}
        >
          {t("tripSettings.saveName")}
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        <h3 className="font-medium">{t("tripSettings.members")}</h3>
        <p className="text-muted-foreground">{t("tripSettings.membersHint")}</p>
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <span className="min-w-0 flex-1 truncate">{member}</span>
              {member !== me && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("tripSettings.removeName", { name: member })}
                  onClick={() =>
                    saveMembers(members.filter((m) => m !== member))
                  }
                >
                  <UserMinus />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={addMember} className="flex flex-col gap-3">
          <Field label={t("tripSettings.addMember")} htmlFor="trip-member">
            <Input
              id="trip-member"
              type="email"
              value={email}
              maxLength={200}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            variant="outline"
            className="self-start"
            disabled={!added}
          >
            <UserPlus />
            {t("tripSettings.addMemberButton")}
          </Button>
        </form>
      </section>
    </div>
  );
}
