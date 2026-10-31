"use client";

import { useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
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
import { RESERVATION_TYPES, type ReservationRecord } from "@/domain/schemas";
import { uniqueId } from "@/domain/trip-edit";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip, useTripStore } from "@/lib/trip-store";

type Editing = { record: ReservationRecord | null } | null;
type ReservationType = ReservationRecord["type"];

export function ReservationsSettings({ tripId }: { tripId: string }) {
  const trip = useTrip();
  const all = useTripStore((s) => s.data.reservations);
  const [editing, setEditing] = useState<Editing>(null);

  function save(record: ReservationRecord) {
    saveRecord(
      tripId,
      "reservations",
      record,
      t("activity.savedBooking", {
        type: t(`reservationType.${record.type}`),
        day: formatDayLabel(record.date),
      }),
    ).catch(() => toast.error(t("common.refused")));
    setEditing(null);
  }

  function archive(r: ReservationRecord) {
    archiveRecord(
      tripId,
      "reservations",
      r,
      t("activity.archivedBooking", {
        type: t(`reservationType.${r.type}`),
        day: formatDayLabel(r.date),
      }),
    ).catch(() => toast.error(t("common.refused")));
    toast(t("bookings.archived"), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(
            tripId,
            "reservations",
            r,
            t("activity.restoredBooking", {
              type: t(`reservationType.${r.type}`),
              day: formatDayLabel(r.date),
            }),
          ).catch(() => toast.error(t("common.refused"))),
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {trip.reservations.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {t(`reservationType.${r.type}`)}
                </Badge>
                <span className="font-medium">
                  {formatDayLabel(r.date)}
                  {r.time && ` · ${r.time}`}
                </span>
              </span>
              <span className="mt-1 block">
                {r.from && r.to
                  ? `${r.from} → ${r.to}`
                  : (r.from ?? r.to ?? "")}
              </span>
              {r.note && (
                <span className="block text-muted-foreground">{r.note}</span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("bookings.edit")}
              onClick={() => setEditing({ record: r })}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("bookings.archiveAria")}
              onClick={() => archive(r)}
            >
              <Archive />
            </Button>
          </li>
        ))}
      </ul>
      {trip.reservations.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("bookings.none")}</p>
      )}
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setEditing({ record: null })}
      >
        <Plus />
        {t("bookings.add")}
      </Button>
      {editing && (
        <ReservationForm
          key={editing.record?.id ?? "new"}
          reservation={editing.record}
          takenIds={all.map((r) => r.id)}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function ReservationForm({
  reservation,
  takenIds,
  onCancel,
  onSave,
}: {
  reservation: ReservationRecord | null;
  takenIds: string[];
  onCancel: () => void;
  onSave: (record: ReservationRecord) => void;
}) {
  const [type, setType] = useState<ReservationType>(
    reservation?.type ?? "train",
  );
  const [date, setDate] = useState(reservation?.date ?? "");
  const [time, setTime] = useState(reservation?.time ?? "");
  const [from, setFrom] = useState(reservation?.from ?? "");
  const [to, setTo] = useState(reservation?.to ?? "");
  const [note, setNote] = useState(reservation?.note ?? "");
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    (time === "" || /^\d{2}:\d{2}$/.test(time));

  function build(): ReservationRecord {
    return {
      id: reservation?.id ?? uniqueId(`${type}-${date}`, takenIds),
      type,
      date,
      time: time || null,
      from: from.trim() || null,
      to: to.trim() || null,
      note: note.trim() || null,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={reservation ? t("bookings.edit") : t("bookings.add")}
      canSubmit={valid}
      onSubmit={() => onSave(build())}
    >
      <Field label={t("common.type")} htmlFor="res-type">
        <Select
          value={type}
          onValueChange={(v) => setType(v as ReservationType)}
        >
          <SelectTrigger id="res-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESERVATION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`reservationType.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.date")} htmlFor="res-date">
          <Input
            id="res-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field label={t("bookings.timeOptional")} htmlFor="res-time">
          <Input
            id="res-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("bookings.from")} htmlFor="res-from">
          <Input
            id="res-from"
            value={from}
            maxLength={100}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label={t("bookings.to")} htmlFor="res-to">
          <Input
            id="res-to"
            value={to}
            maxLength={100}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      <Field
        label={t("common.noteOptional")}
        htmlFor="res-note"
        hint={t("stays.privateHint")}
      >
        <Textarea
          id="res-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </EditPanel>
  );
}
