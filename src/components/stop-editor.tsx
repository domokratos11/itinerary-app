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
import type { MessageKey } from "@/domain/i18n";
import {
  LEG_MODES,
  type LegMode,
  type Place,
  type PlanItem,
} from "@/domain/schemas";
import { t } from "@/lib/i18n";

type Status = "planned" | "done" | "skipped";
const STATUS_LABEL: Record<Status, MessageKey> = {
  planned: "common.planned",
  done: "common.done",
  skipped: "common.skipped",
};

export type StopChanges = Pick<
  PlanItem,
  "startTime" | "durationMin" | "note" | "status" | "legNote"
>;

const NO_NOTE = "none";

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
  const [legMode, setLegMode] = useState<LegMode | typeof NO_NOTE>(
    item.legNote?.mode ?? NO_NOTE,
  );
  const [legMinutes, setLegMinutes] = useState(
    item.legNote?.minutes?.toString() ?? "",
  );
  const [legFare, setLegFare] = useState(
    item.legNote?.fareJPY?.toString() ?? "",
  );
  const [legText, setLegText] = useState(item.legNote?.text ?? "");
  const legMinutesValue = legMinutes.trim() === "" ? null : Number(legMinutes);
  const legFareValue = legFare.trim() === "" ? null : Number(legFare);
  const legValid =
    legMode === NO_NOTE ||
    ((legMinutesValue === null ||
      (Number.isInteger(legMinutesValue) &&
        legMinutesValue > 0 &&
        legMinutesValue <= 1440)) &&
      (legFareValue === null ||
        (Number.isInteger(legFareValue) && legFareValue >= 0)));
  const minutes = duration.trim() === "" ? null : Number(duration);
  const durationValid =
    minutes === null ||
    (Number.isInteger(minutes) && minutes > 0 && minutes <= 1440);

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={place?.name ?? t("stop.edit")}
      description={t("stop.description")}
      canSubmit={durationValid && legValid}
      onSubmit={() =>
        onSave({
          startTime: startTime || null,
          durationMin: minutes,
          note: note.trim() || null,
          status,
          legNote:
            legMode === NO_NOTE
              ? null
              : {
                  mode: legMode,
                  minutes: legMinutesValue,
                  fareJPY: legFareValue,
                  text: legText.trim() || null,
                },
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("stop.startTime")} htmlFor="stop-start">
          <Input
            id="stop-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
        <Field
          label={t("stop.minutes")}
          htmlFor="stop-duration"
          hint={
            place?.durationMin
              ? t("stop.usually", { minutes: place.durationMin })
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
          {t("stop.hours", { hours: place.openingHours })}
        </p>
      )}
      <Field label={t("common.note")} htmlFor="stop-note">
        <Textarea
          id="stop-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <Field
        label={t("stop.gettingHere")}
        htmlFor="stop-leg-mode"
        hint={t("stop.gettingHereHint")}
      >
        <Select
          value={legMode}
          onValueChange={(v) => setLegMode(v as LegMode | typeof NO_NOTE)}
        >
          <SelectTrigger id="stop-leg-mode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_NOTE}>{t("stop.noNote")}</SelectItem>
            {LEG_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {t(`legMode.${mode}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {legMode !== NO_NOTE && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("stop.minutes")} htmlFor="stop-leg-minutes">
              <Input
                id="stop-leg-minutes"
                type="number"
                inputMode="numeric"
                min={1}
                value={legMinutes}
                onChange={(e) => setLegMinutes(e.target.value)}
              />
            </Field>
            <Field label={t("stop.fare")} htmlFor="stop-leg-fare">
              <Input
                id="stop-leg-fare"
                type="number"
                inputMode="numeric"
                min={0}
                value={legFare}
                onChange={(e) => setLegFare(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("stop.lineOrDetails")} htmlFor="stop-leg-text">
            <Input
              id="stop-leg-text"
              value={legText}
              maxLength={200}
              onChange={(e) => setLegText(e.target.value)}
            />
          </Field>
        </>
      )}
      <Field label={t("stop.status")} htmlFor="stop-status">
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger id="stop-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <SelectItem key={s} value={s}>
                {t(STATUS_LABEL[s])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </EditPanel>
  );
}
