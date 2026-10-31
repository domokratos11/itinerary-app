"use client";

import { useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CityRecord } from "@/domain/schemas";
import { uniqueId } from "@/domain/trip-edit";
import { t } from "@/lib/i18n";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip, useTripStore } from "@/lib/trip-store";

type Editing = { record: CityRecord | null } | null;

export function CitiesSettings({ tripId }: { tripId: string }) {
  const trip = useTrip();
  const allCities = useTripStore((s) => s.data.cities);
  const [editing, setEditing] = useState<Editing>(null);

  function save(name: string, color: string) {
    const now = new Date().toISOString();
    const record: CityRecord = editing?.record
      ? { ...editing.record, name, color, updatedAt: now }
      : {
          id: uniqueId(
            name,
            allCities.map((c) => c.id),
          ),
          name,
          color,
          archived: false,
          updatedAt: now,
        };
    saveRecord(
      tripId,
      "cities",
      record,
      editing?.record
        ? t("activity.editedCity", { name })
        : t("activity.addedCity", { name }),
    ).catch(() => toast.error(t("common.refused")));
    setEditing(null);
  }

  function archive(city: CityRecord) {
    archiveRecord(
      tripId,
      "cities",
      city,
      t("activity.archivedCity", { name: city.name }),
    ).catch(() => toast.error(t("common.refused")));
    toast(t("common.archivedName", { name: city.name }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(
            tripId,
            "cities",
            city,
            t("activity.restoredCity", { name: city.name }),
          ).catch(() => toast.error(t("common.refused"))),
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {trip.cities.map((city) => {
          const stays = trip.stays.filter((s) => s.cityId === city.id).length;
          const places = trip.places.filter((p) => p.cityId === city.id).length;
          const inUse = stays > 0 || places > 0;
          return (
            <li
              key={city.id}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: city.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{city.name}</span>
                <span className="text-muted-foreground">
                  {t("citySettings.counts", { stays, places })}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("common.editName", { name: city.name })}
                onClick={() => setEditing({ record: city })}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("citySettings.archiveAria", { name: city.name })}
                title={inUse ? t("citySettings.inUse") : undefined}
                disabled={inUse}
                onClick={() => archive(city)}
              >
                <Archive />
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setEditing({ record: null })}
      >
        <Plus />
        {t("citySettings.add")}
      </Button>
      {editing && (
        <CityForm
          key={editing.record?.id ?? "new"}
          city={editing.record}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

export function CityForm({
  city,
  onCancel,
  onSave,
}: {
  city: CityRecord | null;
  onCancel: () => void;
  onSave: (name: string, color: string) => void;
}) {
  const [name, setName] = useState(city?.name ?? "");
  const [color, setColor] = useState(city?.color ?? "#0f766e");
  const valid = name.trim().length > 0 && /^#[0-9a-fA-F]{6}$/.test(color);

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={
        city ? t("common.editName", { name: city.name }) : t("citySettings.add")
      }
      canSubmit={valid}
      onSubmit={() => onSave(name.trim(), color)}
    >
      <Field label={t("common.name")} htmlFor="city-name">
        <Input
          id="city-name"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <Field
        label={t("citySettings.colour")}
        htmlFor="city-color"
        hint={t("citySettings.colourHint")}
      >
        <Input
          id="city-color"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-20 p-1"
        />
      </Field>
    </EditPanel>
  );
}
