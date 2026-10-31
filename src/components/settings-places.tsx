"use client";

import { useMemo, useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { AddPlace } from "@/components/add-place";
import { PlaceEditor } from "@/components/place-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  hasPin,
  matchesPlaceFilter,
  missingFields,
  PLACE_FILTER_LABEL,
  PLACE_FILTERS,
  RESEARCH_FIELD_LABEL,
  type PlaceFilter,
} from "@/domain/place-edit";
import type { PlaceRecord } from "@/domain/schemas";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip } from "@/lib/trip-store";

const REFUSED = "That change was refused. Check the trip link.";

// Settings → Places: every place by city, with filters for what's missing.
export function PlacesSettings({ tripId }: { tripId: string }) {
  const trip = useTrip();
  const [cityId, setCityId] = useState<string>(trip.cities[0]?.id ?? "");
  const [filter, setFilter] = useState<PlaceFilter>("all");
  const [editing, setEditing] = useState<PlaceRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const reviewable = useMemo(() => new Set<string>(), []);

  const visible = useMemo(
    () =>
      trip.places.filter(
        (p) => p.cityId === cityId && matchesPlaceFilter(p, filter, reviewable),
      ),
    [trip.places, cityId, filter, reviewable],
  );

  function archive(place: PlaceRecord) {
    archiveRecord(tripId, "places", place, `archived ${place.name}`).catch(() =>
      toast.error(REFUSED),
    );
    toast(`Archived ${place.name}`, {
      action: {
        label: "Undo",
        onClick: () =>
          saveRecord(tripId, "places", place, `restored ${place.name}`).catch(
            () => toast.error(REFUSED),
          ),
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={cityId} onValueChange={setCityId}>
          <SelectTrigger aria-label="City" className="w-full">
            <SelectValue placeholder="Choose a city" />
          </SelectTrigger>
          <SelectContent>
            {trip.cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as PlaceFilter)}
        >
          <SelectTrigger aria-label="Filter" className="w-full">
            <SelectValue>{PLACE_FILTER_LABEL[filter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PLACE_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {PLACE_FILTER_LABEL[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {visible.length} {visible.length === 1 ? "place" : "places"}
        </p>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus />
          Add place
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((place) => (
          <PlaceRow
            key={place.id}
            place={place}
            onEdit={() => setEditing(place)}
            onArchive={() => archive(place)}
          />
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No places match this filter.
        </p>
      )}

      {editing && (
        <PlaceEditor
          key={editing.id}
          tripId={tripId}
          place={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && (
        <AddPlace
          tripId={tripId}
          defaultCityId={cityId}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function PlaceRow({
  place,
  onEdit,
  onArchive,
}: {
  place: PlaceRecord;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const missing = missingFields(place);
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3 text-sm">
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-medium">{place.name}</span>
        <span className="flex flex-wrap gap-1.5">
          {!hasPin(place) && <Badge variant="outline">No map pin</Badge>}
          {missing.map((field) => (
            <Badge
              key={field}
              variant="outline"
              className="border-dashed text-muted-foreground"
            >
              No {RESEARCH_FIELD_LABEL[field]}
            </Badge>
          ))}
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${place.name}`}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Archive ${place.name}`}
        onClick={onArchive}
      >
        <Archive />
      </Button>
    </li>
  );
}
