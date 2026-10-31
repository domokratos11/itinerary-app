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
import { CATEGORY_LABEL } from "@/lib/category-label";
import { saveRecord } from "@/lib/trip-actions";

const REFUSED = "That change was refused. Check the trip link.";

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
    saveRecord(tripId, "places", result.place, `edited ${place.name}`).catch(
      () => toast.error(REFUSED),
    );
    toast(`Saved ${result.place.name}`, {
      action: {
        label: "Undo",
        onClick: () =>
          saveRecord(tripId, "places", place, `undid an edit to ${place.name}`)
            .catch(() => toast.error(REFUSED)),
      },
    });
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Edit ${place.name}`}
      description="Research won't change anything you edit here."
      canSubmit={result.ok}
      onSubmit={save}
    >
      <Field label="Name" htmlFor="place-name">
        <Input id="place-name" maxLength={200} required {...text("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="place-category">
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
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority" htmlFor="place-priority">
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
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Why go" htmlFor="place-purpose">
        <Textarea id="place-purpose" maxLength={1000} {...text("purpose")} />
      </Field>
      <Field label="About" htmlFor="place-description">
        <Textarea
          id="place-description"
          maxLength={3000}
          {...text("description")}
        />
      </Field>
      <Field label="Tips" htmlFor="place-tips" hint="One per line.">
        <Textarea id="place-tips" {...text("tips")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost (¥)" htmlFor="place-cost" hint="0 means free.">
          <Input
            id="place-cost"
            type="number"
            inputMode="numeric"
            min={0}
            {...text("cost")}
          />
        </Field>
        <Field label="Time needed (min)" htmlFor="place-duration">
          <Input
            id="place-duration"
            type="number"
            inputMode="numeric"
            min={1}
            {...text("duration")}
          />
        </Field>
      </div>
      <Field label="Opening hours" htmlFor="place-hours">
        <Input id="place-hours" maxLength={500} {...text("openingHours")} />
      </Field>
      <Field
        label="Closed on"
        htmlFor="place-closed"
        hint="Dates such as 2026-12-29, separated by commas."
      >
        <Input id="place-closed" {...text("closedDates")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Season from" htmlFor="place-season-from">
          <Input
            id="place-season-from"
            type="date"
            {...text("seasonFrom")}
          />
        </Field>
        <Field label="Season to" htmlFor="place-season-to">
          <Input id="place-season-to" type="date" {...text("seasonTo")} />
        </Field>
      </div>
      <Field label="Nearest station" htmlFor="place-station">
        <Input id="place-station" maxLength={100} {...text("stationName")} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <Field
          label="Lines"
          htmlFor="place-station-lines"
          hint="Separated by commas."
        >
          <Input id="place-station-lines" {...text("stationLines")} />
        </Field>
        <Field label="Walk (min)" htmlFor="place-station-walk">
          <Input
            id="place-station-walk"
            type="number"
            inputMode="numeric"
            min={0}
            {...text("stationWalk")}
          />
        </Field>
      </div>
      <Field label="Website" htmlFor="place-website">
        <Input
          id="place-website"
          type="url"
          inputMode="url"
          maxLength={500}
          {...text("websiteUrl")}
        />
      </Field>
      <Field label="Google Maps link" htmlFor="place-maps">
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
        <Field label="Latitude" htmlFor="place-lat">
          <Input id="place-lat" inputMode="decimal" {...text("lat")} />
        </Field>
        <Field label="Longitude" htmlFor="place-lng">
          <Input id="place-lng" inputMode="decimal" {...text("lng")} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="place-notes">
        <Textarea id="place-notes" maxLength={2000} {...text("notes")} />
      </Field>
      <Field label="Last checked" htmlFor="place-verified">
        <Input id="place-verified" type="date" {...text("verifiedAt")} />
      </Field>
      {!result.ok && (
        <p role="alert" className="text-sm text-destructive">
          Check this field: {result.problem}
        </p>
      )}
    </EditPanel>
  );
}
