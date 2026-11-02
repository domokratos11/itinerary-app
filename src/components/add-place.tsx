"use client";

import { useState } from "react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { PlaceSuggestions } from "@/components/place-suggestions";
import { CategoryOption, PriorityOption } from "@/components/tag-badges";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapsError, type PlaceSuggestion } from "@/domain/maps-service";
import { newDraftPlace, parseMapsLink } from "@/domain/place-edit";
import {
  CATEGORIES,
  PRIORITIES,
  type Category,
  type Priority,
} from "@/domain/schemas";
import { t } from "@/lib/i18n";
import { mapsService } from "@/lib/maps-service-instance";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip, useTripStore } from "@/lib/trip-store";
import { usePlaceSuggestions } from "@/lib/use-place-suggestions";

// Type a name or paste a Maps link. A name offers Google's suggestions when
// the map is set up and there is signal; without them it is still saved, and
// maps:match finds the place ID later.
export function AddPlace({
  tripId,
  defaultCityId,
  onClose,
}: {
  tripId: string;
  defaultCityId: string;
  onClose: () => void;
}) {
  const trip = useTrip();
  const allPlaces = useTripStore((s) => s.data.places);
  const [cityId, setCityId] = useState(defaultCityId);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<Category>("sight");
  const [priority, setPriority] = useState<Priority>("want");
  const [chosen, setChosen] = useState<PlaceSuggestion | null>(null);
  const [saving, setSaving] = useState(false);

  const trimmed = input.trim();
  const looksLikeLink = /^https?:\/\//i.test(trimmed);
  const link = looksLikeLink ? parseMapsLink(trimmed) : null;
  const badLink = looksLikeLink && !link;
  const finalName = (looksLikeLink ? name : chosen ? name : trimmed).trim();
  const valid = cityId !== "" && finalName !== "" && !badLink && !saving;
  const suggestions = usePlaceSuggestions(input, !looksLikeLink && !chosen);

  function choose(suggestion: PlaceSuggestion) {
    setChosen(suggestion);
    setName(suggestion.name);
  }

  async function save() {
    setSaving(true);
    let point: { lat: number; lng: number } | null = null;
    if (chosen) {
      try {
        point = await mapsService.locatePlace(chosen.placeId);
      } catch (error) {
        // The place ID is enough: maps:refresh can fetch the coordinates.
        if (!(error instanceof MapsError)) throw error;
      }
    }
    const place = newDraftPlace(
      {
        name: finalName,
        cityId,
        category,
        priority,
        mapsUrl: link ? trimmed : null,
        lat: point?.lat ?? link?.lat ?? null,
        lng: point?.lng ?? link?.lng ?? null,
        googlePlaceId: chosen?.placeId ?? null,
        purpose: note,
        fromGoogle: point !== null,
        takenIds: allPlaces.map((p) => p.id),
      },
      new Date(),
    );
    onClose();
    saveRecord(
      tripId,
      "places",
      place,
      t("activity.addedPlace", { name: place.name }),
    ).catch(() => toast.error(t("common.refused")));
    toast(t("place.added", { name: place.name }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          archiveRecord(
            tripId,
            "places",
            place,
            t("activity.removedPlace", { name: place.name }),
          ).catch(() => toast.error(t("common.refused"))),
      },
    });
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("common.addPlace")}
      description={t("place.addDescription")}
      submitLabel={t("common.add")}
      canSubmit={valid}
      onSubmit={() => void save()}
    >
      <Field label={t("common.city")} htmlFor="add-place-city">
        <Select value={cityId} onValueChange={setCityId}>
          <SelectTrigger id="add-place-city" className="w-full">
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
        label={t("place.nameOrLink")}
        htmlFor="add-place-input"
        hint={
          badLink ? t("place.badLink") : chosen ? t("place.matched") : undefined
        }
      >
        <Input
          id="add-place-input"
          value={input}
          maxLength={500}
          aria-invalid={badLink}
          onChange={(e) => {
            const value = e.target.value;
            setInput(value);
            setChosen(null);
            const parsed = /^https?:\/\//i.test(value.trim())
              ? parseMapsLink(value)
              : null;
            setName(parsed?.name ?? "");
          }}
        />
      </Field>
      <PlaceSuggestions suggestions={suggestions} onChoose={choose} />
      {(looksLikeLink || chosen) && (
        <Field label={t("common.name")} htmlFor="add-place-name">
          <Input
            id="add-place-name"
            value={name}
            maxLength={200}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.category")} htmlFor="add-place-category">
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as Category)}
          >
            <SelectTrigger id="add-place-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  <CategoryOption category={c} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("common.priority")} htmlFor="add-place-priority">
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as Priority)}
          >
            <SelectTrigger id="add-place-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  <PriorityOption priority={p} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label={t("common.noteOptional")} htmlFor="add-place-note">
        <Input
          id="add-place-note"
          value={note}
          maxLength={500}
          placeholder={t("place.whyWeWant")}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </EditPanel>
  );
}
