"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { placesToMove } from "@/domain/place-edit";
import type { PlaceRecord } from "@/domain/schemas";
import { t } from "@/lib/i18n";
import { usePlanStore } from "@/lib/plan-store";
import { saveRecords } from "@/lib/trip-actions";
import { useTrip } from "@/lib/trip-store";

// Settings → Places: move the selected places to another city of the trip.
// Places already on a day stay, so no stop ends up on a day of the wrong city.
export function MovePlaces({
  tripId,
  places,
  fromCityId,
  onClose,
  onMoved,
}: {
  tripId: string;
  places: PlaceRecord[];
  fromCityId: string;
  onClose: () => void;
  onMoved: () => void;
}) {
  const trip = useTrip();
  const items = usePlanStore((s) => s.items);
  const others = trip.cities.filter((c) => c.id !== fromCityId);
  const [cityId, setCityId] = useState(others[0]?.id ?? "");
  const fromName =
    trip.cities.find((c) => c.id === fromCityId)?.name ?? fromCityId;
  const toName = trip.cities.find((c) => c.id === cityId)?.name ?? cityId;
  const { planned, moveCount } = useMemo(() => {
    const plan = placesToMove(places, items, cityId, new Date());
    return { planned: plan.planned, moveCount: plan.moved.length };
  }, [places, items, cityId]);

  function move() {
    const { moved } = placesToMove(places, items, cityId, new Date());
    if (moved.length === 0) return;
    const originals = places.filter((p) => moved.some((m) => m.id === p.id));
    const summary = t("activity.movedPlaces", {
      count: moved.length,
      city: toName,
    });
    saveRecords(tripId, "places", moved, summary).catch(() =>
      toast.error(t("common.refused")),
    );
    toast(t("placeSettings.moved", { count: moved.length, city: toName }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecords(tripId, "places", originals).catch(() =>
            toast.error(t("common.undoFailed")),
          ),
      },
    });
    onMoved();
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("placeSettings.moveTitle", { count: places.length })}
      description={t("placeSettings.moveDescription", { city: fromName })}
      submitLabel={
        moveCount > 0
          ? t("placeSettings.moveConfirm", { count: moveCount })
          : t("placeSettings.move")
      }
      canSubmit={cityId !== "" && moveCount > 0}
      onSubmit={move}
    >
      <Field label={t("placeSettings.moveTo")} htmlFor="move-city">
        <Select value={cityId} onValueChange={setCityId}>
          <SelectTrigger id="move-city" className="w-full">
            <SelectValue placeholder={t("common.chooseCity")} />
          </SelectTrigger>
          <SelectContent>
            {others.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {planned.length > 0 && (
        <p
          role="status"
          className="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
        >
          {moveCount === 0
            ? t("placeSettings.moveNone")
            : t("placeSettings.movePlanned", {
                count: planned.length,
                city: fromName,
                names: planned.map((p) => p.name).join(", "),
              })}
        </p>
      )}
    </EditPanel>
  );
}
