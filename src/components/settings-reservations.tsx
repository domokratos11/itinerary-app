"use client";

import { useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { PRIVATE_NOTE_HINT } from "@/components/settings-stays";
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
import { formatDayLabel } from "@/lib/format-day";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip, useTripStore } from "@/lib/trip-store";

const REFUSED = "That change was refused. Check the trip link.";

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
      `saved the ${record.type} on ${formatDayLabel(record.date)}`,
    ).catch(() => toast.error(REFUSED));
    setEditing(null);
  }

  function archive(r: ReservationRecord) {
    archiveRecord(
      tripId,
      "reservations",
      r,
      `archived the ${r.type} on ${formatDayLabel(r.date)}`,
    ).catch(() => toast.error(REFUSED));
    toast("Reservation archived", {
      action: {
        label: "Undo",
        onClick: () =>
          saveRecord(
            tripId,
            "reservations",
            r,
            `restored the ${r.type} on ${formatDayLabel(r.date)}`,
          ).catch(() => toast.error(REFUSED)),
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
                <Badge variant="outline">{r.type}</Badge>
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
              aria-label="Edit reservation"
              onClick={() => setEditing({ record: r })}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Archive reservation"
              onClick={() => archive(r)}
            >
              <Archive />
            </Button>
          </li>
        ))}
      </ul>
      {trip.reservations.length === 0 && (
        <p className="text-sm text-muted-foreground">No reservations yet.</p>
      )}
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setEditing({ record: null })}
      >
        <Plus />
        Add reservation
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
      title={reservation ? "Edit reservation" : "Add reservation"}
      canSubmit={valid}
      onSubmit={() => onSave(build())}
    >
      <Field label="Type" htmlFor="res-type">
        <Select
          value={type}
          onValueChange={(v) => setType(v as ReservationType)}
        >
          <SelectTrigger id="res-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESERVATION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="res-date">
          <Input
            id="res-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Time (optional)" htmlFor="res-time">
          <Input
            id="res-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor="res-from">
          <Input
            id="res-from"
            value={from}
            maxLength={100}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To" htmlFor="res-to">
          <Input
            id="res-to"
            value={to}
            maxLength={100}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Note (optional)"
        htmlFor="res-note"
        hint={PRIVATE_NOTE_HINT}
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
