"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PlaceDetails, type NearbyPlace } from "@/components/place-details";
import {
  CATEGORIES,
  PRIORITIES,
  type CityRecord,
  type PlaceRecord,
} from "@/domain/schemas";
import { filterPlaces, type CatalogFilter } from "@/lib/catalog-filter";
import { CATEGORY_LABEL } from "@/lib/category-label";
import { CostLine } from "@/components/cost-line";
import { isDraft } from "@/domain/queue";
import { usePlanStore } from "@/lib/plan-store";
import { PlaceFormPanel } from "@/components/place-form";
import { CityForm } from "@/components/settings-cities";
import { Button } from "@/components/ui/button";
import {
  newPlaceRecord,
  placeFromForm,
  type PlaceForm,
} from "@/domain/place-edit";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

const REFUSED = "That change was refused. Check the trip link.";

type Props = {
  city: CityRecord;
  places: PlaceRecord[];
  tripId: string | null;
  // Every place id in the trip, archived ones included, so new ids stay unique.
  takenIds: string[];
  nearby: Record<string, NearbyPlace[]>;
  // Opens this place's details first (from search).
  initialPlaceId?: string | null;
};

const initialFilter: CatalogFilter = {
  category: "all",
  priority: "all",
  unassignedOnly: false,
};

export function CityCatalog({
  city,
  places,
  tripId,
  takenIds,
  nearby,
  initialPlaceId = null,
}: Props) {
  const [filter, setFilter] = useState<CatalogFilter>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(initialPlaceId);
  const [editing, setEditing] = useState<{ place: PlaceRecord | null } | null>(
    null,
  );
  const [editingCity, setEditingCity] = useState(false);
  const items = usePlanStore((s) => s.items);

  // Places with an active plan item are assigned; the rest are unassigned.
  const assigned = useMemo(
    () =>
      new Set(
        items.filter((i) => i.status !== "removed").map((i) => i.placeId),
      ),
    [items],
  );

  const visible = useMemo(
    () => filterPlaces(places, filter, assigned),
    [places, filter, assigned],
  );
  const selected = places.find((p) => p.id === selectedId) ?? null;
  // Estimated cost of this city's planned stops.
  const planned = useMemo(() => {
    const byId = new Map(places.map((p) => [p.id, p]));
    return items
      .filter((i) => i.status !== "removed" && byId.has(i.placeId))
      .map((i) => byId.get(i.placeId));
  }, [items, places]);

  function savePlace(form: PlaceForm): string | null {
    if (!tripId) return "The trip isn't loaded yet.";
    const existing = editing?.place ?? null;
    const now = new Date().toISOString();
    const result = placeFromForm(form, {
      status: existing?.status ?? "researched",
      source: existing?.source ?? "catalog",
      verifiedAt: existing?.verifiedAt ?? null,
      archived: false,
      updatedAt: now,
    });
    if (!result.ok) return result.error;
    const record = existing
      ? { ...existing, ...result.fields }
      : newPlaceRecord(result.fields, city.id, takenIds);
    saveRecord(
      tripId,
      "places",
      record,
      `${existing ? "edited" : "added"} the place ${record.name}`,
    ).catch(() => toast.error(REFUSED));
    setEditing(null);
    return null;
  }

  function archivePlace(place: PlaceRecord) {
    if (!tripId) return;
    archiveRecord(
      tripId,
      "places",
      place,
      `archived the place ${place.name}`,
    ).catch(() => toast.error(REFUSED));
    setSelectedId(null);
    toast(`Archived ${place.name}`, {
      action: {
        label: "Undo",
        onClick: () =>
          saveRecord(
            tripId,
            "places",
            place,
            `restored the place ${place.name}`,
          ).catch(() => toast.error(REFUSED)),
      },
    });
  }

  function saveCity(name: string, color: string) {
    if (!tripId) return;
    saveRecord(
      tripId,
      "cities",
      { ...city, name, color, updatedAt: new Date().toISOString() },
      `edited the city ${name}`,
    ).catch(() => toast.error(REFUSED));
    setEditingCity(false);
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">
            {city.name}
          </h1>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${city.name}`}
            disabled={!tripId}
            onClick={() => setEditingCity(true)}
          >
            <Pencil />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!tripId}
            onClick={() => setEditing({ place: null })}
          >
            <Plus />
            Add place
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {visible.length} of {places.length} places
        </p>
        <CostLine places={planned} />
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:rounded-xl lg:border lg:bg-card lg:p-4">
          <h2 className="hidden text-sm font-medium lg:block">Filter</h2>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter.category}
            onValueChange={(value) => {
              if (value)
                setFilter({
                  ...filter,
                  category: value as CatalogFilter["category"],
                });
            }}
            className="flex flex-wrap justify-start"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            {CATEGORIES.map((c) => (
              <ToggleGroupItem key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex flex-wrap items-center justify-between gap-3 lg:flex-col lg:items-start">
            <Select
              value={filter.priority}
              onValueChange={(value) =>
                setFilter({
                  ...filter,
                  priority: value as CatalogFilter["priority"],
                })
              }
            >
              <SelectTrigger className="w-40 lg:w-full">
                <SelectValue>
                  {filter.priority === "all"
                    ? "All priorities"
                    : filter.priority}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="unassigned-only"
                checked={filter.unassignedOnly}
                onCheckedChange={(checked) =>
                  setFilter({ ...filter, unassignedOnly: checked })
                }
              />
              <Label htmlFor="unassigned-only">Unassigned only</Label>
            </div>
          </div>
        </aside>

        <div className="flex flex-col gap-3">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((place) => (
              <li key={place.id}>
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(place.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setSelectedId(place.id);
                  }}
                  className="h-full cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50"
                >
                  <CardHeader>
                    <CardTitle className="text-base">{place.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {CATEGORY_LABEL[place.category]}
                    </Badge>
                    <Badge variant="outline" className="text-foreground">
                      {place.priority}
                    </Badge>
                    {assigned.has(place.id) && <Badge>In plan</Badge>}
                    {isDraft(place) && (
                      <Badge variant="outline" className="border-dashed">
                        Not researched yet
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No places match these filters.
            </p>
          )}
        </div>
      </div>

      <PlaceDetails
        place={selected}
        nearby={selected ? (nearby[selected.id] ?? []) : []}
        inPlan={selected ? assigned.has(selected.id) : false}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onEdit={(place) => {
          setSelectedId(null);
          setEditing({ place });
        }}
        onArchive={archivePlace}
      />
      {editing && (
        <PlaceFormPanel
          key={editing.place?.id ?? "new"}
          place={editing.place}
          cityName={city.name}
          onCancel={() => setEditing(null)}
          onSave={savePlace}
        />
      )}
      {editingCity && (
        <CityForm
          city={city}
          onCancel={() => setEditingCity(false)}
          onSave={saveCity}
        />
      )}
    </>
  );
}
