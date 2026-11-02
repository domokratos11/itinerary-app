"use client";

import { useMemo, useState } from "react";
import { Archive, MapPinOff, Pencil, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { LogCostButton } from "@/components/expense-form";
import { PlaceSuggestions } from "@/components/place-suggestions";
import { Badge } from "@/components/ui/badge";
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
import { placePoint } from "@/domain/map-pins";
import { MapsError, type PlaceSuggestion } from "@/domain/maps-service";
import { parseMapsLink } from "@/domain/place-edit";
import type { StayRecord } from "@/domain/schemas";
import { isUndecidedHotel, stayId } from "@/domain/trip";
import { dayChanges, stayIssues, type DayChanges } from "@/domain/trip-edit";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { mapsService } from "@/lib/maps-service-instance";
import { usePlanStore } from "@/lib/plan-store";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useCitiesById, useTrip, useTripStore } from "@/lib/trip-store";
import { usePlaceSuggestions } from "@/lib/use-place-suggestions";

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
      t("activity.savedStay", {
        hotel: record.hotelName,
        from: formatDayLabel(record.checkIn),
        to: formatDayLabel(record.checkOut),
      }),
    ).catch(() => toast.error(t("common.refused")));
    setEditing(null);
  }

  function archive(stay: StayRecord) {
    archiveRecord(
      tripId,
      "stays",
      stay,
      t("activity.archivedStay", { hotel: stay.hotelName }),
    ).catch(() => toast.error(t("common.refused")));
    setEditing(null);
    toast(t("stays.archived", { hotel: stay.hotelName }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(
            tripId,
            "stays",
            stay,
            t("activity.restoredStay", { hotel: stay.hotelName }),
          ).catch(() => toast.error(t("common.refused"))),
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
            ? t("stays.gap", {
                from: formatDayLabel(issue.from),
                to: formatDayLabel(issue.to),
              })
            : t("stays.overlap", {
                from: formatDayLabel(issue.from),
                to: formatDayLabel(issue.to),
              })}
        </p>
      ))}

      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
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
                  {formatDayLabel(stay.checkOut)} ·{" "}
                  {t("stays.nights", { count: n })}
                </span>
                {stay.note && <span className="block">{stay.note}</span>}
                {!placePoint(stay) && !isUndecidedHotel(stay.hotelName) && (
                  <Badge
                    variant="outline"
                    className="mt-1 border-dashed text-muted-foreground"
                  >
                    <MapPinOff />
                    {t("stays.noLocation")}
                  </Badge>
                )}
              </span>
              <LogCostButton
                tripId={tripId}
                prefill={{
                  title: stay.hotelName,
                  category: "booking",
                  date: stay.checkIn,
                  stayId: stay.id,
                }}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("stays.editAria", { hotel: stay.hotelName })}
                onClick={() => setEditing({ kind: "edit", record: stay })}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("stays.archiveAria", { hotel: stay.hotelName })}
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
        {t("common.addStay")}
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
          title={t("stays.archiveTitle")}
          description={`${editing.record.hotelName}, ${formatDayLabel(editing.record.checkIn)} → ${formatDayLabel(editing.record.checkOut)}`}
          submitLabel={t("common.archive")}
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
  const [chosen, setChosen] = useState<PlaceSuggestion | null>(null);
  const [saving, setSaving] = useState(false);

  const renamed = hotelName.trim() !== (stay?.hotelName ?? "");
  // Shown until a place is picked: for a hotel with no location yet, or once
  // the name no longer matches the place that was saved.
  const suggestions = usePlaceSuggestions(
    hotelName,
    !chosen &&
      !isUndecidedHotel(hotelName) &&
      (renamed || !stay || !placePoint(stay)),
  );

  const datesValid = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && checkOut > checkIn;
  const urlValid = mapsUrl.trim() === "" || URL.canParse(mapsUrl.trim());
  const valid =
    cityId !== "" && hotelName.trim() !== "" && datesValid && urlValid;

  function build(): StayRecord {
    const url = mapsUrl.trim() || null;
    // Coordinates come from a full Maps place link; otherwise keep the old
    // ones only if the link didn't change.
    const parsed = url ? parseMapsLink(url) : null;
    // A new link or a new name means another place, so its location goes too.
    const samePlace = url === (stay?.hotelMapsUrl ?? null) && !renamed;
    const lat = parsed?.lat ?? (samePlace ? (stay?.lat ?? null) : null);
    const lng = parsed?.lng ?? (samePlace ? (stay?.lng ?? null) : null);
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
      // It replaces what maps:match found for the old one.
      googlePlaceId: samePlace ? (stay?.googlePlaceId ?? null) : null,
      locationFetchedAt: samePlace ? (stay?.locationFetchedAt ?? null) : null,
      locationSource: samePlace
        ? (stay?.locationSource ?? null)
        : lat !== null
          ? "manual"
          : null,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
  }

  async function submit() {
    const record = build();
    if (!chosen) return onSave(record);
    setSaving(true);
    let point: { lat: number; lng: number } | null = null;
    try {
      point = await mapsService.locatePlace(chosen.placeId);
    } catch (error) {
      // The place ID is enough: maps:refresh can fetch the coordinates.
      if (!(error instanceof MapsError)) throw error;
    }
    onSave({
      ...record,
      googlePlaceId: chosen.placeId,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      locationFetchedAt: point ? new Date().toISOString() : null,
      locationSource: point ? "google" : null,
    });
  }

  const pinned = chosen !== null || placePoint(build()) !== null;

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={stay ? t("stays.edit") : t("common.addStay")}
      canSubmit={valid && !saving}
      onSubmit={() => void submit()}
    >
      <Field label={t("common.city")} htmlFor="stay-city">
        <Select value={cityId} onValueChange={setCityId}>
          <SelectTrigger id="stay-city" className="w-full">
            <SelectValue placeholder={t("common.chooseCity")} />
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
      <Field
        label={t("stays.hotel")}
        htmlFor="stay-hotel"
        hint={
          isUndecidedHotel(hotelName) || hotelName.trim() === ""
            ? undefined
            : pinned
              ? t("stays.pinned")
              : t("stays.pickToPin")
        }
      >
        <Input
          id="stay-hotel"
          value={hotelName}
          maxLength={200}
          onChange={(e) => {
            setHotelName(e.target.value);
            setChosen(null);
          }}
          placeholder={t("stays.toBeDecided")}
          required
        />
      </Field>
      <PlaceSuggestions
        suggestions={suggestions}
        onChoose={(suggestion) => {
          setChosen(suggestion);
          setHotelName(suggestion.name);
        }}
      />
      <Field
        label={t("stays.mapsOptional")}
        htmlFor="stay-maps"
        hint={t("stays.mapsHint")}
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
        <Field label={t("stays.checkIn")} htmlFor="stay-in">
          <Input
            id="stay-in"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
          />
        </Field>
        <Field label={t("stays.checkOut")} htmlFor="stay-out">
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
          {t("stays.checkOutAfter")}
        </p>
      )}
      <Field
        label={t("common.noteOptional")}
        htmlFor="stay-note"
        hint={t("stays.privateHint")}
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
      <p className="text-sm text-muted-foreground">{t("stays.sameDays")}</p>
    );
  return (
    <ul className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-sm">
      {added.length > 0 && (
        <li>
          {t("stays.adds", { days: added.map(formatDayLabel).join(", ") })}
        </li>
      )}
      {removed.length > 0 && (
        <li>
          {t("stays.removes", { days: removed.map(formatDayLabel).join(", ") })}
        </li>
      )}
      {stranded > 0 && (
        <li className="font-medium text-destructive">
          {t("stays.stranded", { count: stranded })}
        </li>
      )}
    </ul>
  );
}
