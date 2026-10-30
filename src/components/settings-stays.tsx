"use client";

import { useMemo, useState } from "react";
import { Archive, Pencil, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
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
import { parseMapsLink } from "@/domain/queue";
import type { StayRecord } from "@/domain/schemas";
import { stayId } from "@/domain/trip";
import { dayChanges, stayIssues, type DayChanges } from "@/domain/trip-edit";
import { formatDayLabel } from "@/lib/format-day";
import { usePlanStore } from "@/lib/plan-store";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useCitiesById, useTrip, useTripStore } from "@/lib/trip-store";

const REFUSED = "That change was refused. Check the trip link.";
export const PRIVATE_NOTE_HINT =
  "Anyone with the trip link can read this. Don't add booking or confirmation numbers.";

type Editing =
  | { kind: "edit"; record: StayRecord | null }
  | { kind: "archive"; record: StayRecord }
  | null;

function nights(checkIn: string, checkOut: string): number {
  const ms =
    Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function StaysSettings({ tripId }: { tripId: string }) {
  const trip = useTrip();
  const allStays = useTripStore((s) => s.data.stays);
  const citiesById = useCitiesById();
  const items = usePlanStore((s) => s.items);
  const [editing, setEditing] = useState<Editing>(null);
  const issues = useMemo(() => stayIssues(trip.stays), [trip.stays]);

  // The day preview for replacing (or removing) one stay.
  function preview(next: StayRecord | null, replacing: string | null) {
    const others = trip.stays.filter((s) => s.id !== replacing);
    return dayChanges(
      trip.stays,
      next ? [...others, next] : others,
      items,
      trip.places,
    );
  }

  function save(record: StayRecord) {
    saveRecord(
      tripId,
      "stays",
      record,
      `saved the stay at ${record.hotelName} (${formatDayLabel(record.checkIn)} → ${formatDayLabel(record.checkOut)})`,
    ).catch(() => toast.error(REFUSED));
    setEditing(null);
  }

  function archive(stay: StayRecord) {
    archiveRecord(
      tripId,
      "stays",
      stay,
      `archived the stay at ${stay.hotelName}`,
    ).catch(() => toast.error(REFUSED));
    setEditing(null);
    toast(`Archived the stay at ${stay.hotelName}`, {
      action: {
        label: "Undo",
        onClick: () =>
          saveRecord(
            tripId,
            "stays",
            stay,
            `restored the stay at ${stay.hotelName}`,
          ).catch(() => toast.error(REFUSED)),
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {issues.map((issue) => (
        <p
          key={`${issue.kind}-${issue.from}`}
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {issue.kind === "gap"
            ? `No hotel from ${formatDayLabel(issue.from)} to ${formatDayLabel(issue.to)}.`
            : `Two hotels overlap from ${formatDayLabel(issue.from)} to ${formatDayLabel(issue.to)}.`}
        </p>
      ))}

      <ol className="flex flex-col gap-2">
        {trip.stays.map((stay) => {
          const city = citiesById.get(stay.cityId);
          const n = nights(stay.checkIn, stay.checkOut);
          return (
            <li
              key={stay.id}
              className="flex items-start gap-3 rounded-lg border p-3 text-sm"
            >
              <span
                aria-hidden
                className="mt-1.5 size-3 shrink-0 rounded-full"
                style={{ backgroundColor: city?.color ?? "#64748b" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{stay.hotelName}</span>
                <span className="block text-muted-foreground">
                  {city?.name ?? stay.cityId} · {formatDayLabel(stay.checkIn)} →{" "}
                  {formatDayLabel(stay.checkOut)} · {n}{" "}
                  {n === 1 ? "night" : "nights"}
                </span>
                {stay.note && <span className="block">{stay.note}</span>}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit stay at ${stay.hotelName}`}
                onClick={() => setEditing({ kind: "edit", record: stay })}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Archive stay at ${stay.hotelName}`}
                onClick={() => setEditing({ kind: "archive", record: stay })}
              >
                <Archive />
              </Button>
            </li>
          );
        })}
      </ol>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setEditing({ kind: "edit", record: null })}
      >
        <Plus />
        Add stay
      </Button>

      {editing?.kind === "edit" && (
        <StayForm
          key={editing.record?.id ?? "new"}
          stay={editing.record}
          takenIds={allStays.map((s) => s.id)}
          defaultCheckIn={trip.stays.at(-1)?.checkOut ?? "2026-12-17"}
          preview={(next) => preview(next, editing.record?.id ?? null)}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
      {editing?.kind === "archive" && (
        <EditPanel
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title="Archive this stay?"
          description={`${editing.record.hotelName}, ${formatDayLabel(editing.record.checkIn)} → ${formatDayLabel(editing.record.checkOut)}`}
          submitLabel="Archive"
          onSubmit={() => archive(editing.record)}
        >
          <ChangePreview changes={preview(null, editing.record.id)} />
        </EditPanel>
      )}
    </div>
  );
}

function StayForm({
  stay,
  takenIds,
  defaultCheckIn,
  preview,
  onCancel,
  onSave,
}: {
  stay: StayRecord | null;
  takenIds: string[];
  defaultCheckIn: string;
  preview: (next: StayRecord) => DayChanges;
  onCancel: () => void;
  onSave: (record: StayRecord) => void;
}) {
  const trip = useTrip();
  const [cityId, setCityId] = useState(
    stay?.cityId ?? trip.cities[0]?.id ?? "",
  );
  const [hotelName, setHotelName] = useState(stay?.hotelName ?? "");
  const [mapsUrl, setMapsUrl] = useState(stay?.hotelMapsUrl ?? "");
  const [checkIn, setCheckIn] = useState(stay?.checkIn ?? defaultCheckIn);
  const [checkOut, setCheckOut] = useState(stay?.checkOut ?? "");
  const [note, setNote] = useState(stay?.note ?? "");

  const datesValid = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && checkOut > checkIn;
  const urlValid = mapsUrl.trim() === "" || URL.canParse(mapsUrl.trim());
  const valid =
    cityId !== "" && hotelName.trim() !== "" && datesValid && urlValid;

  function build(): StayRecord {
    const url = mapsUrl.trim() || null;
    // Coordinates come from a full Maps place link; otherwise keep the old
    // ones only if the link didn't change.
    const parsed = url ? parseMapsLink(url) : null;
    const sameLink = url === (stay?.hotelMapsUrl ?? null);
    const lat = parsed?.lat ?? (sameLink ? (stay?.lat ?? null) : null);
    const lng = parsed?.lng ?? (sameLink ? (stay?.lng ?? null) : null);
    let id = stay?.id ?? stayId({ cityId, checkIn });
    if (!stay && takenIds.includes(id)) id = `${id}-${takenIds.length + 1}`;
    return {
      id,
      cityId,
      hotelName: hotelName.trim(),
      hotelMapsUrl: url,
      lat,
      lng,
      checkIn,
      checkOut,
      note: note.trim() || null,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={stay ? "Edit stay" : "Add stay"}
      canSubmit={valid}
      onSubmit={() => onSave(build())}
    >
      <Field label="City" htmlFor="stay-city">
        <Select value={cityId} onValueChange={setCityId}>
          <SelectTrigger id="stay-city" className="w-full">
            <SelectValue placeholder="Choose a city" />
          </SelectTrigger>
          <SelectContent>
            {trip.cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Hotel" htmlFor="stay-hotel">
        <Input
          id="stay-hotel"
          value={hotelName}
          maxLength={200}
          onChange={(e) => setHotelName(e.target.value)}
          placeholder="To be decided"
          required
        />
      </Field>
      <Field
        label="Google Maps link (optional)"
        htmlFor="stay-maps"
        hint="A full place link also saves the hotel's exact location."
      >
        <Input
          id="stay-maps"
          type="url"
          inputMode="url"
          value={mapsUrl}
          maxLength={500}
          onChange={(e) => setMapsUrl(e.target.value)}
          aria-invalid={!urlValid}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in" htmlFor="stay-in">
          <Input
            id="stay-in"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
          />
        </Field>
        <Field label="Check-out" htmlFor="stay-out">
          <Input
            id="stay-out"
            type="date"
            value={checkOut}
            min={checkIn}
            onChange={(e) => setCheckOut(e.target.value)}
            aria-invalid={checkOut !== "" && !datesValid}
            required
          />
        </Field>
      </div>
      {checkOut !== "" && !datesValid && (
        <p role="alert" className="text-sm text-destructive">
          Check-out must be after check-in.
        </p>
      )}
      <Field
        label="Note (optional)"
        htmlFor="stay-note"
        hint={PRIVATE_NOTE_HINT}
      >
        <Textarea
          id="stay-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {valid && <ChangePreview changes={preview(build())} />}
    </EditPanel>
  );
}

// "Adds Dec 28 · Removes Dec 26, Dec 27 · 1 stop will need a new day".
export function ChangePreview({ changes }: { changes: DayChanges }) {
  const { added, removed, stranded } = changes;
  if (added.length === 0 && removed.length === 0 && stranded === 0)
    return (
      <p className="text-sm text-muted-foreground">
        The trip&apos;s days stay the same.
      </p>
    );
  return (
    <ul className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-sm">
      {added.length > 0 && <li>Adds {added.map(formatDayLabel).join(", ")}</li>}
      {removed.length > 0 && (
        <li>Removes {removed.map(formatDayLabel).join(", ")}</li>
      )}
      {stranded > 0 && (
        <li className="font-medium text-destructive">
          {stranded} {stranded === 1 ? "stop" : "stops"} will need a new day
        </li>
      )}
    </ul>
  );
}
