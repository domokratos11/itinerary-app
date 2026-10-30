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
import { formFromPlace, type PlaceForm } from "@/domain/place-edit";
import {
  CATEGORIES,
  PRIORITIES,
  type Category,
  type PlaceRecord,
  type Priority,
} from "@/domain/schemas";
import { CATEGORY_LABEL } from "@/lib/category-label";

// Edit a place, or add one when `place` is null. `onSave` returns an error
// message to show, or null once the change is made.
export function PlaceFormPanel({
  place,
  cityName,
  onCancel,
  onSave,
}: {
  place: PlaceRecord | null;
  cityName: string;
  onCancel: () => void;
  onSave: (form: PlaceForm) => string | null;
}) {
  const [form, setForm] = useState(() => formFromPlace(place));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PlaceForm>(key: K, value: PlaceForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={place ? `Edit ${place.name}` : `Add a place in ${cityName}`}
      description="Leave a field blank if you don't know it yet."
      canSubmit={form.name.trim().length > 0}
      onSubmit={() => setError(onSave(form))}
    >
      <Field label="Name" htmlFor="place-name">
        <Input
          id="place-name"
          value={form.name}
          maxLength={200}
          onChange={(e) => set("name", e.target.value)}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="place-category">
          <Select
            value={form.category}
            onValueChange={(v) => set("category", v as Category)}
          >
            <SelectTrigger id="place-category" className="w-full">
              <SelectValue>{CATEGORY_LABEL[form.category]}</SelectValue>
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
            onValueChange={(v) => set("priority", v as Priority)}
          >
            <SelectTrigger id="place-priority" className="w-full">
              <SelectValue>{form.priority}</SelectValue>
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
      <Field
        label="Google Maps link"
        htmlFor="place-maps"
        hint="Blank = a Maps search on the name."
      >
        <Input
          id="place-maps"
          type="url"
          inputMode="url"
          value={form.mapsUrl}
          onChange={(e) => set("mapsUrl", e.target.value)}
        />
      </Field>
      <Field label="Why go" htmlFor="place-purpose">
        <Textarea
          id="place-purpose"
          rows={2}
          value={form.purpose}
          onChange={(e) => set("purpose", e.target.value)}
        />
      </Field>
      <Field label="About" htmlFor="place-description">
        <Textarea
          id="place-description"
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <Field label="Tips" htmlFor="place-tips" hint="One per line.">
        <Textarea
          id="place-tips"
          rows={3}
          value={form.tips}
          onChange={(e) => set("tips", e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost (¥)" htmlFor="place-cost" hint="0 = free.">
          <Input
            id="place-cost"
            inputMode="numeric"
            value={form.cost}
            onChange={(e) => set("cost", e.target.value)}
          />
        </Field>
        <Field label="Minutes needed" htmlFor="place-duration">
          <Input
            id="place-duration"
            inputMode="numeric"
            value={form.durationMin}
            onChange={(e) => set("durationMin", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Opening hours" htmlFor="place-hours">
        <Input
          id="place-hours"
          value={form.openingHours}
          onChange={(e) => set("openingHours", e.target.value)}
        />
      </Field>
      <Field
        label="Closed on"
        htmlFor="place-closed"
        hint="Dates like 2026-12-31, separated by commas."
      >
        <Input
          id="place-closed"
          value={form.closedDates}
          onChange={(e) => set("closedDates", e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Season from" htmlFor="place-from">
          <Input
            id="place-from"
            type="date"
            value={form.seasonFrom}
            onChange={(e) => set("seasonFrom", e.target.value)}
          />
        </Field>
        <Field label="Season to" htmlFor="place-to">
          <Input
            id="place-to"
            type="date"
            value={form.seasonTo}
            onChange={(e) => set("seasonTo", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Website" htmlFor="place-website">
        <Input
          id="place-website"
          type="url"
          inputMode="url"
          value={form.websiteUrl}
          onChange={(e) => set("websiteUrl", e.target.value)}
        />
      </Field>
      <Field label="Notes" htmlFor="place-notes">
        <Textarea
          id="place-notes"
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </EditPanel>
  );
}
