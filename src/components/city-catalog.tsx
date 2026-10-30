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
  type City,
  type Place,
} from "@/domain/schemas";
import { filterPlaces, type CatalogFilter } from "@/lib/catalog-filter";
import { CATEGORY_LABEL } from "@/lib/category-label";
import { CostLine } from "@/components/cost-line";
import { isDraft } from "@/domain/queue";
import { usePlanStore } from "@/lib/plan-store";

type Props = {
  city: City;
  places: Place[];
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
  nearby,
  initialPlaceId = null,
}: Props) {
  const [filter, setFilter] = useState<CatalogFilter>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(initialPlaceId);
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

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{city.name}</h1>
        <p className="text-sm text-muted-foreground">
          {visible.length} of {places.length} places
        </p>
        <CostLine places={planned} />
      </header>

      <div className="flex flex-col gap-3">
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select
            value={filter.priority}
            onValueChange={(value) =>
              setFilter({
                ...filter,
                priority: value as CatalogFilter["priority"],
              })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                {filter.priority === "all" ? "All priorities" : filter.priority}
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
      </div>

      <ul className="flex flex-col gap-3">
        {visible.map((place) => (
          <li key={place.id}>
            <Card
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(place.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedId(place.id);
              }}
              className="cursor-pointer transition-colors hover:bg-muted/50"
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

      <PlaceDetails
        place={selected}
        nearby={selected ? (nearby[selected.id] ?? []) : []}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </>
  );
}
