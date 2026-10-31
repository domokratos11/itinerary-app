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
import { TripMap } from "@/components/trip-map";
import { cityPins } from "@/domain/map-pins";
import {
  CATEGORIES,
  PRIORITIES,
  type CityRecord,
  type PlaceRecord,
} from "@/domain/schemas";
import { t } from "@/lib/i18n";
import { filterPlaces, type CatalogFilter } from "@/lib/catalog-filter";
import { categoryLabel } from "@/lib/category-label";
import { CostLine } from "@/components/cost-line";
import { isDraft } from "@/domain/queue";
import { useMediaQuery } from "@/lib/use-media-query";
import { usePlanStore } from "@/lib/plan-store";
import { cn } from "@/lib/utils";
import { AddPlace } from "@/components/add-place";
import { CityForm } from "@/components/settings-cities";
import { Button } from "@/components/ui/button";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

type Props = {
  city: CityRecord;
  places: PlaceRecord[];
  tripId: string | null;
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
  nearby,
  initialPlaceId = null,
}: Props) {
  const [filter, setFilter] = useState<CatalogFilter>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(initialPlaceId);
  const [adding, setAdding] = useState(false);
  const [editingCity, setEditingCity] = useState(false);
  const items = usePlanStore((s) => s.items);
  const [view, setView] = useState<"list" | "map">("list");
  // Wide enough for the map beside the grid; otherwise a switch.
  const sideBySide = useMediaQuery("(min-width: 1280px)");
  const showMap = sideBySide || view === "map";
  const showList = sideBySide || view === "list";

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
  const pins = useMemo(() => cityPins(visible), [visible]);
  const unpinned = visible.length - pins.length;
  // Estimated cost of this city's planned stops.
  const planned = useMemo(() => {
    const byId = new Map(places.map((p) => [p.id, p]));
    return items
      .filter((i) => i.status !== "removed" && byId.has(i.placeId))
      .map((i) => byId.get(i.placeId));
  }, [items, places]);

  function archivePlace(place: PlaceRecord) {
    if (!tripId) return;
    archiveRecord(
      tripId,
      "places",
      place,
      t("activity.archivedPlace", { name: place.name }),
    ).catch(() => toast.error(t("common.refused")));
    setSelectedId(null);
    toast(t("common.archivedName", { name: place.name }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(
            tripId,
            "places",
            place,
            t("activity.restoredPlace", { name: place.name }),
          ).catch(() => toast.error(t("common.refused"))),
      },
    });
  }

  function saveCity(name: string, color: string) {
    if (!tripId) return;
    saveRecord(
      tripId,
      "cities",
      { ...city, name, color, updatedAt: new Date().toISOString() },
      t("activity.editedCity", { name }),
    ).catch(() => toast.error(t("common.refused")));
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
            aria-label={t("common.editName", { name: city.name })}
            onClick={() => setEditingCity(true)}
          >
            <Pencil />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus />
            {t("common.addPlace")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("cities.placesShown", {
            shown: visible.length,
            total: places.length,
          })}
        </p>
        <CostLine places={planned} />
        {!sideBySide && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => {
              if (value) setView(value as "list" | "map");
            }}
            className="mt-1 justify-start"
          >
            <ToggleGroupItem value="list">{t("common.list")}</ToggleGroupItem>
            <ToggleGroupItem value="map">{t("common.map")}</ToggleGroupItem>
          </ToggleGroup>
        )}
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
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
            <ToggleGroupItem value="all">{t("cities.all")}</ToggleGroupItem>
            {CATEGORIES.map((c) => (
              <ToggleGroupItem key={c} value={c}>
                {categoryLabel(c)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-start lg:gap-6">
            <Select
              value={filter.priority}
              onValueChange={(value) =>
                setFilter({
                  ...filter,
                  priority: value as CatalogFilter["priority"],
                })
              }
            >
              <SelectTrigger className="w-fit min-w-44">
                <SelectValue>
                  {filter.priority === "all"
                    ? t("cities.allPriorities")
                    : t(`priorities.${filter.priority}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("cities.allPriorities")}</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`priorities.${p}`)}
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
              <Label htmlFor="unassigned-only">
                {t("cities.unassignedOnly")}
              </Label>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col gap-4",
            sideBySide &&
              "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start",
          )}
        >
          {showList && (
            <div className="flex flex-col gap-3">
              <ul
                className={cn(
                  "grid gap-3",
                  sideBySide ? "2xl:grid-cols-2" : "sm:grid-cols-2",
                )}
              >
                {visible.map((place) => (
                  <li key={place.id}>
                    <Card
                      size="sm"
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
                        <CardTitle className="text-base">
                          {place.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {categoryLabel(place.category)}
                        </Badge>
                        <Badge variant="outline" className="text-foreground">
                          {t(`priorities.${place.priority}`)}
                        </Badge>
                        {assigned.has(place.id) && (
                          <Badge>{t("cities.inPlanBadge")}</Badge>
                        )}
                        {isDraft(place) && (
                          <Badge variant="outline" className="border-dashed">
                            {t("common.notResearched")}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
              {visible.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {places.length === 0
                    ? t("cities.noPlaces")
                    : t("cities.noMatches")}
                </p>
              )}
            </div>
          )}
          {showMap && (
            <div className={cn(sideBySide && "sticky top-20")}>
              <TripMap
                pins={pins}
                onPinClick={setSelectedId}
                className={
                  sideBySide
                    ? "aspect-[4/3] max-h-[calc(100vh-7rem)]"
                    : "h-[65vh]"
                }
                note={
                  unpinned > 0
                    ? t("cities.unpinned", { unpinned, total: visible.length })
                    : null
                }
              />
            </div>
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
        onArchive={tripId ? archivePlace : undefined}
      />
      {adding && tripId && (
        <AddPlace
          tripId={tripId}
          defaultCityId={city.id}
          onClose={() => setAdding(false)}
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
