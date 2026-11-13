"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/edit-panel";
import { GoogleAttribution } from "@/components/place-live";
import { PlaceSuggestions } from "@/components/place-suggestions";
import { CategoryOption } from "@/components/tag-badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  MapsError,
  type NearbyPlace,
  type PlaceSuggestion,
} from "@/domain/maps-service";
import { formatDistance, typeLabel } from "@/domain/nearby";
import { waitingPlaces } from "@/domain/plan";
import { categoryFromGoogleType, newDraftPlace } from "@/domain/place-edit";
import { CATEGORIES, type Category, type PlanItem } from "@/domain/schemas";
import { currentPosition, LocationError } from "@/lib/device-location";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { mapsService } from "@/lib/maps-service-instance";
import { addPlaceAt, removeItem, updateItem } from "@/lib/plan-actions";
import { usePlanStore } from "@/lib/plan-store";
import { todayInTokyo } from "@/lib/tokyo-date";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useCitiesById, useTripStore } from "@/lib/trip-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { useOnline } from "@/lib/use-online";
import { usePlaceSuggestions } from "@/lib/use-place-suggestions";

const RADIUS_M = 500;

type Props = {
  tripId: string;
  date: string;
  // Where in the day's stops the new one goes: 0 is before the first.
  index: number;
  dayItems: PlanItem[];
  cityIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// What the nearby search came to. The phone's position is only used for the
// search and is not kept.
type Nearby =
  | { kind: "loading" }
  | { kind: "ready"; places: NearbyPlace[] }
  | { kind: "fallback"; reason: string };

// A business picked from the list or from a name search.
type Chosen = {
  placeId: string;
  name: string;
  primaryType: string | null;
  location: { lat: number; lng: number } | null;
};

// The "+" in a gap of the day's line opens this: businesses near the phone,
// then a short confirm, then the stop is in the day exactly there.
export function QuickAddSheet(props: Props) {
  const wide = useMediaQuery("(min-width: 768px)");
  const { open, onOpenChange } = props;
  const body = open && <QuickAddBody {...props} />;

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="pr-10">
            <DialogTitle>{t("quickAdd.title")}</DialogTitle>
            <DialogDescription>{t("quickAdd.description")}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{t("quickAdd.title")}</DrawerTitle>
          <DrawerDescription>{t("quickAdd.description")}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {body}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function failureText(reason: string): string {
  switch (reason) {
    case "denied":
      return t("quickAdd.denied");
    case "timeout":
      return t("quickAdd.timeout");
    case "unsupported":
      return t("quickAdd.unsupported");
    case "not-configured":
      return t("quickAdd.notConfigured");
    case "offline":
      return t("quickAdd.offline");
    case "failed":
    case "quota":
      return t("quickAdd.failed");
    default:
      return t("quickAdd.unavailable");
  }
}

function QuickAddBody({
  tripId,
  date,
  index,
  dayItems,
  cityIds,
  onOpenChange,
}: Props) {
  const online = useOnline();
  const configured = mapsService.isConfigured();
  const places = useTripStore((s) => s.data.places);
  const items = usePlanStore((s) => s.items);
  const citiesById = useCitiesById();
  const [nearby, setNearby] = useState<Nearby>(
    !configured
      ? { kind: "fallback", reason: "not-configured" }
      : { kind: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Chosen | null>(null);

  useEffect(() => {
    if (!configured) return;
    let stopped = false;
    currentPosition()
      .then((center) => mapsService.nearbyPlaces(center, RADIUS_M))
      .then((found) => {
        if (!stopped) setNearby({ kind: "ready", places: found });
      })
      .catch((error: unknown) => {
        if (stopped) return;
        const reason =
          error instanceof LocationError
            ? error.reason
            : error instanceof MapsError
              ? error.kind
              : "failed";
        setNearby({ kind: "fallback", reason });
      });
    return () => {
      stopped = true;
    };
  }, [configured, attempt]);

  const waiting = useMemo(
    () => waitingPlaces(places, items, cityIds),
    [places, items, cityIds],
  );
  const suggestions = usePlaceSuggestions(
    search,
    nearby.kind === "fallback" && chosen === null,
  );

  function refresh() {
    setNearby({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  function addWaiting(placeId: string, name: string) {
    onOpenChange(false);
    addPlaceAt(tripId, placeId, date, index, dayItems)
      .then((stop) =>
        toast(t("common.addedToDay", { name, day: formatDayLabel(date) }), {
          action: {
            label: t("common.undo"),
            onClick: () =>
              removeItem(tripId, stop).catch(() =>
                toast.error(t("common.undoFailed")),
              ),
          },
        }),
      )
      .catch(() => toast.error(t("common.refused")));
  }

  if (chosen) {
    return (
      <Confirm
        tripId={tripId}
        date={date}
        index={index}
        dayItems={dayItems}
        cityIds={cityIds}
        cityName={(id) => citiesById.get(id)?.name ?? id}
        chosen={chosen}
        takenIds={places.map((p) => p.id)}
        onBack={() => setChosen(null)}
        onDone={() => onOpenChange(false)}
      />
    );
  }

  const needle = filter.trim().toLowerCase();
  const shown =
    nearby.kind === "ready"
      ? nearby.places.filter((p) => p.name.toLowerCase().includes(needle))
      : [];

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-base font-semibold">
            {t("quickAdd.nearbyHeading")}
          </h3>
          {configured && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={nearby.kind === "loading" || !online}
            >
              <RefreshCw />
              {t("quickAdd.refresh")}
            </Button>
          )}
        </div>
        {nearby.kind === "loading" && (
          <p className="text-sm text-muted-foreground" role="status">
            {t("quickAdd.loading")}
          </p>
        )}
        {nearby.kind === "ready" && (
          <>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label={t("quickAdd.filterLabel")}
              placeholder={t("quickAdd.filterPlaceholder")}
              maxLength={100}
            />
            {nearby.places.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("quickAdd.empty")}
              </p>
            )}
            {nearby.places.length > 0 && shown.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("quickAdd.noMatches")}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {shown.map((place) => (
                <li key={place.placeId}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-between gap-3 py-2 text-left whitespace-normal"
                    onClick={() =>
                      setChosen({
                        placeId: place.placeId,
                        name: place.name,
                        primaryType: place.primaryType,
                        location: place.location,
                      })
                    }
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{place.name}</span>
                      {typeLabel(place.primaryType) && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {typeLabel(place.primaryType)}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                      {formatDistance(place.distanceM)}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <GoogleAttribution />
            </div>
          </>
        )}
        {nearby.kind === "fallback" && (
          <>
            <p className="text-sm text-muted-foreground">
              {failureText(nearby.reason)}
            </p>
            {configured && online && (
              <>
                <Field
                  label={t("quickAdd.searchLabel")}
                  htmlFor="quick-add-search"
                >
                  <Input
                    id="quick-add-search"
                    value={search}
                    maxLength={200}
                    placeholder={t("quickAdd.searchPlaceholder")}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Field>
                <PlaceSuggestions
                  suggestions={suggestions}
                  onChoose={(s: PlaceSuggestion) =>
                    setChosen({
                      placeId: s.placeId,
                      name: s.name,
                      primaryType: null,
                      location: null,
                    })
                  }
                />
                {suggestions.length > 0 && (
                  <div className="flex justify-end">
                    <GoogleAttribution />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-base font-semibold">
          {t("quickAdd.waitingHeading")}
        </h3>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("quickAdd.waitingEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {waiting.map((place) => (
              <li key={place.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                  onClick={() => addWaiting(place.id, place.name)}
                >
                  {place.name}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Confirm({
  tripId,
  date,
  index,
  dayItems,
  cityIds,
  cityName,
  chosen,
  takenIds,
  onBack,
  onDone,
}: {
  tripId: string;
  date: string;
  index: number;
  dayItems: PlanItem[];
  cityIds: string[];
  cityName: (id: string) => string;
  chosen: Chosen;
  takenIds: string[];
  onBack: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(chosen.name);
  const [cityId, setCityId] = useState(cityIds[0] ?? "");
  const [category, setCategory] = useState<Category>(
    categoryFromGoogleType(chosen.primaryType),
  );
  const [hereNow, setHereNow] = useState(date === todayInTokyo());
  const [saving, setSaving] = useState(false);
  const valid = name.trim() !== "" && cityId !== "" && !saving;

  async function save() {
    setSaving(true);
    let point = chosen.location;
    if (!point) {
      try {
        point = await mapsService.locatePlace(chosen.placeId);
      } catch (error) {
        // The place ID is enough: maps:refresh can fetch the coordinates.
        if (!(error instanceof MapsError)) throw error;
      }
    }
    const place = newDraftPlace(
      {
        name,
        cityId,
        category,
        priority: "want",
        mapsUrl: null,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        googlePlaceId: chosen.placeId,
        fromGoogle: point !== null,
        takenIds,
      },
      new Date(),
    );
    onDone();
    try {
      await saveRecord(
        tripId,
        "places",
        place,
        t("activity.addedPlace", { name: place.name }),
      );
      const stop = await addPlaceAt(tripId, place.id, date, index, dayItems);
      let latest = stop;
      if (hereNow) {
        latest = { ...stop, status: "done" };
        await updateItem(tripId, stop, { status: "done" });
      }
      toast(t("quickAdd.addedPlace", { name: place.name }), {
        action: {
          label: t("common.undo"),
          onClick: () =>
            Promise.all([
              removeItem(tripId, latest),
              archiveRecord(
                tripId,
                "places",
                place,
                t("activity.removedPlace", { name: place.name }),
              ),
            ]).catch(() => toast.error(t("common.undoFailed"))),
        },
      });
    } catch {
      toast.error(t("common.refused"));
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void save();
      }}
    >
      <Field label={t("common.name")} htmlFor="quick-add-name">
        <Input
          id="quick-add-name"
          value={name}
          maxLength={200}
          required
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      {cityIds.length > 1 && (
        <Field label={t("common.city")} htmlFor="quick-add-city">
          <Select value={cityId} onValueChange={setCityId}>
            <SelectTrigger id="quick-add-city" className="w-full">
              <SelectValue placeholder={t("common.chooseCity")} />
            </SelectTrigger>
            <SelectContent>
              {cityIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {cityName(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label={t("common.category")} htmlFor="quick-add-category">
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as Category)}
        >
          <SelectTrigger id="quick-add-category" className="w-full">
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="quick-add-here">{t("quickAdd.hereNow")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("quickAdd.hereNowHint")}
          </p>
        </div>
        <Switch
          id="quick-add-here"
          checked={hereNow}
          onCheckedChange={setHereNow}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          {t("quickAdd.back")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t("quickAdd.save")}
        </Button>
      </div>
    </form>
  );
}
