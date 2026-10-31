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
import { HOLIDAY_KINDS, type HolidayRecord } from "@/domain/schemas";
import { uniqueId } from "@/domain/trip-edit";
import { t } from "@/lib/i18n";
import { formatDayLabel } from "@/lib/format-day";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip, useTripStore } from "@/lib/trip-store";

type Editing = { record: HolidayRecord | null } | null;
type HolidayKind = HolidayRecord["kind"];

// The holidays and closure periods of this trip. Days show the note, and
// stops on those dates get a warning.
export function HolidaysSettings({ tripId }: { tripId: string }) {
  const trip = useTrip();
  const all = useTripStore((s) => s.data.holidays);
  const [editing, setEditing] = useState<Editing>(null);
  const holidays = [...trip.holidays].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  function save(record: HolidayRecord) {
    saveRecord(
      tripId,
      "holidays",
      record,
      t("activity.savedHoliday", { name: record.name }),
    ).catch(() => toast.error(t("common.refused")));
    setEditing(null);
  }

  function archive(h: HolidayRecord) {
    archiveRecord(
      tripId,
      "holidays",
      h,
      t("activity.archivedHoliday", { name: h.name }),
    ).catch(() => toast.error(t("common.refused")));
    toast(t("holidays.archived"), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(
            tripId,
            "holidays",
            h,
            t("activity.restoredHoliday", { name: h.name }),
          ).catch(() => toast.error(t("common.refused"))),
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {holidays.map((h) => (
          <li
            key={h.id}
            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(`holidays.${h.kind}`)}</Badge>
                <span className="font-medium">
                  {formatDayLabel(h.date)} · {h.name}
                </span>
              </span>
              {h.note && (
                <span className="mt-1 block text-muted-foreground">
                  {h.note}
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("holidays.edit")}
              onClick={() => setEditing({ record: h })}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("holidays.archiveAria")}
              onClick={() => archive(h)}
            >
              <Archive />
            </Button>
          </li>
        ))}
      </ul>
      {holidays.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("holidays.none")}</p>
      )}
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setEditing({ record: null })}
      >
        <Plus />
        {t("holidays.add")}
      </Button>
      {editing && (
        <HolidayForm
          key={editing.record?.id ?? "new"}
          holiday={editing.record}
          takenIds={all.map((h) => h.id)}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function HolidayForm({
  holiday,
  takenIds,
  onCancel,
  onSave,
}: {
  holiday: HolidayRecord | null;
  takenIds: string[];
  onCancel: () => void;
  onSave: (record: HolidayRecord) => void;
}) {
  const [kind, setKind] = useState<HolidayKind>(holiday?.kind ?? "holiday");
  const [date, setDate] = useState(holiday?.date ?? "");
  const [name, setName] = useState(holiday?.name ?? "");
  const [note, setNote] = useState(holiday?.note ?? "");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && name.trim().length > 0;

  function build(): HolidayRecord {
    return {
      id: holiday?.id ?? uniqueId(`holiday-${date}`, takenIds),
      date,
      name: name.trim(),
      kind,
      note: note.trim() || null,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={holiday ? t("holidays.edit") : t("holidays.add")}
      canSubmit={valid}
      onSubmit={() => onSave(build())}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.date")} htmlFor="holiday-date">
          <Input
            id="holiday-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field label={t("common.type")} htmlFor="holiday-kind">
          <Select value={kind} onValueChange={(v) => setKind(v as HolidayKind)}>
            <SelectTrigger id="holiday-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOLIDAY_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`holidays.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label={t("common.name")} htmlFor="holiday-name">
        <Input
          id="holiday-name"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <Field label={t("common.noteOptional")} htmlFor="holiday-note">
        <Textarea
          id="holiday-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </EditPanel>
  );
}
