"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import {
  placeToForm,
  validatePlaceForm,
  type PlaceForm,
} from "@/domain/place-edit";
import {
  CATEGORIES,
  PRIORITIES,
  type Category,
  type PlaceRecord,
  type Priority,
} from "@/domain/schemas";
import { t } from "@/lib/i18n";
import { categoryLabel } from "@/lib/category-label";
import { saveRecord } from "@/lib/trip-actions";

// Every field of a place. Fields changed here are locked, so research won't
// change them later. Saved through saveRecord, with an Undo.
export function PlaceEditor({
  tripId,
  place,
  onClose,
}: {
  tripId: string;
  place: PlaceRecord;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PlaceForm>(() => placeToForm(place));
  const result = validatePlaceForm(place, form, new Date());

  function text(field: keyof PlaceForm) {
    return {
      value: form[field],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setForm({ ...form, [field]: e.target.value }),
    };
  }

  function save() {
    if (!result.ok) return;
    onClose();
    saveRecord(
      tripId,
      "places",
      result.place,
      t("activity.editedPlace", { name: place.name }),
    ).catch(() => toast.error(t("common.refused")));
    toast(t("place.saved", { name: result.place.name }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(
            tripId,
            "places",
            place,
            t("activity.undidEdit", { name: place.name }),
          ).catch(() => toast.error(t("common.refused"))),
      },
    });
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("common.editName", { name: place.name })}
      description={t("place.editDescription")}
      canSubmit={result.ok}
      onSubmit={save}
    >
      <Field label={t("common.name")} htmlFor="place-name">
        <Input id="place-name" maxLength={200} required {...text("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.category")} htmlFor="place-category">
          <Select
            value={form.category}
            onValueChange={(v) => setForm({ ...form, category: v as Category })}
          >
            <SelectTrigger id="place-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("common.priority")} htmlFor="place-priority">
          <Select
            value={form.priority}
            onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
          >
            <SelectTrigger id="place-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`priorities.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label={t("common.whyGo")} htmlFor="place-purpose">
        <Textarea id="place-purpose" maxLength={1000} {...text("purpose")} />
      </Field>
      <Field label={t("common.about")} htmlFor="place-description">
        <Textarea
          id="place-description"
          maxLength={3000}
          {...text("description")}
        />
      </Field>
      <Field
        label={t("common.tips")}
        htmlFor="place-tips"
        hint={t("place.onePerLine")}
      >
        <Textarea id="place-tips" {...text("tips")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("place.costYen")}
          htmlFor="place-cost"
          hint={t("place.zeroFree")}
        >
          <Input
            id="place-cost"
            type="number"
            inputMode="numeric"
            min={0}
            {...text("cost")}
          />
        </Field>
        <Field label={t("place.timeNeededMin")} htmlFor="place-duration">
          <Input
            id="place-duration"
            type="number"
            inputMode="numeric"
            min={1}
            {...text("duration")}
          />
        </Field>
      </div>
      <Field label={t("common.openingHours")} htmlFor="place-hours">
        <Input id="place-hours" maxLength={500} {...text("openingHours")} />
      </Field>
      <Field
        label={t("common.closedOn")}
        htmlFor="place-closed"
        hint={t("place.closedHint")}
      >
        <Input id="place-closed" {...text("closedDates")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.seasonFrom")} htmlFor="place-season-from">
          <Input id="place-season-from" type="date" {...text("seasonFrom")} />
        </Field>
        <Field label={t("common.seasonTo")} htmlFor="place-season-to">
          <Input id="place-season-to" type="date" {...text("seasonTo")} />
        </Field>
      </div>
      <Field label={t("common.nearestStation")} htmlFor="place-station">
        <Input id="place-station" maxLength={100} {...text("stationName")} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <Field
          label={t("place.lines")}
          htmlFor="place-station-lines"
          hint={t("place.commaSeparated")}
        >
          <Input id="place-station-lines" {...text("stationLines")} />
        </Field>
        <Field label={t("place.walkMin")} htmlFor="place-station-walk">
          <Input
            id="place-station-walk"
            type="number"
            inputMode="numeric"
            min={0}
            {...text("stationWalk")}
          />
        </Field>
      </div>
      <Field label={t("common.website")} htmlFor="place-website">
        <Input
          id="place-website"
          type="url"
          inputMode="url"
          maxLength={500}
          {...text("websiteUrl")}
        />
      </Field>
      <Field label={t("common.googleMapsLink")} htmlFor="place-maps">
        <Input
          id="place-maps"
          type="url"
          inputMode="url"
          maxLength={500}
          required
          {...text("mapsUrl")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("place.latitude")} htmlFor="place-lat">
          <Input id="place-lat" inputMode="decimal" {...text("lat")} />
        </Field>
        <Field label={t("place.longitude")} htmlFor="place-lng">
          <Input id="place-lng" inputMode="decimal" {...text("lng")} />
        </Field>
      </div>
      <Field label={t("common.notes")} htmlFor="place-notes">
        <Textarea id="place-notes" maxLength={2000} {...text("notes")} />
      </Field>
      <Field label={t("common.lastChecked")} htmlFor="place-verified">
        <Input id="place-verified" type="date" {...text("verifiedAt")} />
      </Field>
      {!result.ok && (
        <p role="alert" className="text-sm text-destructive">
          {t("place.checkField", { problem: result.problem })}
        </p>
      )}
    </EditPanel>
  );
}
