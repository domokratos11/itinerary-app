"use client";

import { useState } from "react";

import { EditPanel, Field } from "@/components/edit-panel";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Place, PlanItem } from "@/domain/schemas";

type Status = "planned" | "done" | "skipped";
const STATUS_LABEL: Record<Status, string> = {
  planned: "Planned",
  done: "Done",
  skipped: "Skipped",
};

export type StopChanges = Pick<
  PlanItem,
  "startTime" | "durationMin" | "note" | "status"
>;

// Start time, how long, a note, and whether the stop was done or skipped.
export function StopEditor({
  item,
  place,
  onCancel,
  onSave,
}: {
  item: PlanItem;
  place: Place | undefined;
  onCancel: () => void;
  onSave: (changes: StopChanges) => void;
}) {
  const [startTime, setStartTime] = useState(item.startTime ?? "");
  const [duration, setDuration] = useState(item.durationMin?.toString() ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [status, setStatus] = useState<Status>(
    item.status === "removed" ? "planned" : item.status,
  );
  const minutes = duration.trim() === "" ? null : Number(duration);
  const durationValid =
    minutes === null ||
    (Number.isInteger(minutes) && minutes > 0 && minutes <= 1440);

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={place?.name ?? "Edit stop"}
      description="Time, duration and notes for this stop."
      canSubmit={durationValid}
      onSubmit={() =>
        onSave({
          startTime: startTime || null,
          durationMin: minutes,
          note: note.trim() || null,
          status,
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time" htmlFor="stop-start">
          <Input
            id="stop-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
        <Field
          label="Minutes"
          htmlFor="stop-duration"
          hint={
            place?.durationMin
              ? `Usually about ${place.durationMin} min`
              : undefined
          }
        >
          <Input
            id="stop-duration"
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            placeholder={place?.durationMin?.toString() ?? ""}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-invalid={!durationValid}
          />
        </Field>
      </div>
      {place?.openingHours && (
        <p className="text-xs text-muted-foreground">
          Hours: {place.openingHours}
        </p>
      )}
      <Field label="Note" htmlFor="stop-note">
        <Textarea
          id="stop-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <Field label="Status" htmlFor="stop-status">
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger id="stop-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </EditPanel>
  );
}
