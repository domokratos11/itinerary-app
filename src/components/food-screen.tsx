"use client";

import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock,
  ExternalLink,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { TripMap, type MapFocus } from "@/components/trip-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { citiesInTripOrder } from "@/domain/city-notes";
import {
  cancelCategoryResearch,
  categoryLabel,
  categorySearchUrl,
  citySpots,
  cityStays,
  draftFromSpot,
  foodCategories,
  foodPins,
  foodSpotMapsUrl,
  FOOD_PRICE_LEVELS,
  isResearchRequested,
  moveCategory,
  newCustomCategory,
  requestCategoryResearch,
  spotFromDraft,
  spotsByCategory,
  type FoodCategory,
  type FoodCategoryKey,
  type FoodRepository,
  type FoodSpot,
  type FoodSpotDraft,
} from "@/domain/food";
import type { CityRecord, StayRecord } from "@/domain/schemas";
import { foodRepository } from "@/lib/food-repository-instance";
import { t } from "@/lib/i18n";
import { pageHref } from "@/lib/links";
import { useTrip } from "@/lib/trip-store";
import { useFood, type FoodData } from "@/lib/use-food";
import { useMediaQuery } from "@/lib/use-media-query";
import { useTripId } from "@/lib/use-trip-id";
import { cn } from "@/lib/utils";

// /food/ lists the trip's cities; /food/?id= shows where to eat in one, by
// category, with each spot a link to Google Maps and a pin once it has a
// place ID. Researched spots come from a research run
// (docs/food-research.md); members add their own and their own categories.
export function FoodScreen({
  repository = foodRepository,
}: {
  repository?: FoodRepository;
}) {
  const id = useSearchParams().get("id");
  const tripId = useTripId();
  const food = useFood(tripId, repository);
  return id ? (
    <FoodCityDetail
      cityId={id}
      tripId={tripId}
      food={food}
      repository={repository}
    />
  ) : (
    <FoodCityList tripId={tripId} food={food} />
  );
}

const builtInName = (key: FoodCategoryKey) => t(`food.category.${key}`);
const labelOf = (category: FoodCategory) =>
  categoryLabel(category, builtInName);

function FoodCityList({
  tripId,
  food,
}: {
  tripId: string | null;
  food: FoodData | null;
}) {
  const trip = useTrip();
  const cities = useMemo(
    () => citiesInTripOrder(trip.cities, trip.stays),
    [trip.cities, trip.stays],
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t("food.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("food.subtitle")}</p>
      </div>
      {cities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("food.noCities")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cities.map((city) => {
            const spots = food ? citySpots(food.spots, city.id) : [];
            const hotel = cityStays(trip.stays, city.id)[0];
            const starred = spots.filter((s) => s.starred).length;
            return (
              <li key={city.id}>
                <Link
                  href={pageHref("/food/", tripId, { id: city.id })}
                  className="block h-full"
                >
                  <Card className="h-full transition-colors hover:bg-muted/40">
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: city.color }}
                        />
                        {city.name}
                        {starred > 0 && (
                          <Badge variant="secondary">
                            <Star aria-hidden />
                            {starred}
                          </Badge>
                        )}
                      </CardTitle>
                      {hotel && (
                        <CardDescription>{hotel.hotelName}</CardDescription>
                      )}
                      <CardDescription>
                        {spots.length > 0
                          ? t("food.spotCount", { count: spots.length })
                          : t("food.noneYet")}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type Filter = { categoryId: string | "all"; starredOnly: boolean };

function FoodCityDetail({
  cityId,
  tripId,
  food,
  repository,
}: {
  cityId: string;
  tripId: string | null;
  food: FoodData | null;
  repository: FoodRepository;
}) {
  const trip = useTrip();
  const city = trip.cities.find((c) => c.id === cityId && !c.archived);
  const stays = useMemo(
    () => cityStays(trip.stays, cityId),
    [trip.stays, cityId],
  );
  const categories = useMemo(
    () => foodCategories(food?.categories ?? []),
    [food],
  );
  const spots = useMemo(
    () => (food ? citySpots(food.spots, cityId) : []),
    [food, cityId],
  );
  const [filter, setFilter] = useState<Filter>({
    categoryId: "all",
    starredOnly: false,
  });
  const [view, setView] = useState<"list" | "map">("list");
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [editing, setEditing] = useState<FoodSpot | "new" | null>(null);
  const [managing, setManaging] = useState(false);
  const cards = useRef(new Map<string, HTMLElement>());
  // Wide enough for the map beside the list; otherwise a switch.
  const sideBySide = useMediaQuery("(min-width: 1024px)");
  const showMap = sideBySide || view === "map";
  const showList = sideBySide || view === "list";

  const visible = useMemo(
    () =>
      spots.filter(
        (s) =>
          (filter.categoryId === "all" || s.categoryId === filter.categoryId) &&
          (!filter.starredOnly || s.starred),
      ),
    [spots, filter],
  );
  const shownCategories = categories.filter(
    (c) => filter.categoryId === "all" || c.id === filter.categoryId,
  );
  const groups = spotsByCategory(visible, shownCategories);
  const pins = useMemo(() => foodPins(visible, stays), [visible, stays]);
  const unpinned = visible.filter((s) => s.lat === null).length;

  const back = (
    <Button asChild variant="ghost" size="sm" className="self-start">
      <Link href={pageHref("/food/", tripId)}>
        <ArrowLeft data-icon="inline-start" />
        {t("food.allCities")}
      </Link>
    </Button>
  );

  if (!city)
    return (
      <div className="flex flex-col gap-3">
        {back}
        <h1 className="text-3xl font-bold">{t("cities.notFound")}</h1>
      </div>
    );

  function saveSpot(next: FoodSpot, done: string | null, undo?: FoodSpot) {
    if (!tripId) return;
    repository
      .saveSpot(tripId, next)
      .then(() => {
        if (!done) return;
        if (undo)
          toast(done, {
            action: {
              label: t("common.undo"),
              onClick: () => {
                repository
                  .saveSpot(tripId, {
                    ...undo,
                    updatedAt: new Date().toISOString(),
                  })
                  .catch(() => toast.error(t("common.undoFailed")));
              },
            },
          });
        else toast.success(done);
      })
      .catch(() => toast.error(t("food.saveFailed")));
  }

  function saveCategories(rows: FoodCategory[], done: string | null) {
    if (!tripId || rows.length === 0) return;
    Promise.all(rows.map((row) => repository.saveCategory(tripId, row)))
      .then(() => done && toast.success(done))
      .catch(() => toast.error(t("food.saveFailed")));
  }

  function showOnMap(spot: FoodSpot) {
    setView("map");
    setFocus({ id: spot.id });
  }

  function pinClicked(id: string) {
    setHighlighted(id);
    if (!sideBySide) setView("list");
    // After the list is back on screen.
    requestAnimationFrame(() =>
      cards.current.get(id)?.scrollIntoView?.({ block: "center" }),
    );
  }

  const hotel = stays[0] ?? null;
  const categoryOptions = categories;

  return (
    <div className="flex flex-col gap-4">
      {back}
      <header className="flex flex-col gap-2">
        <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: city.color }}
          />
          {t("food.cityTitle", { city: city.name })}
        </h1>
        {stays.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("food.basedAt", {
              hotels: stays.map((s) => s.hotelName).join(" · "),
            })}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" />
            {t("food.addSpot")}
          </Button>
          <Button variant="outline" onClick={() => setManaging(true)}>
            <Settings2 data-icon="inline-start" />
            {t("food.categories")}
          </Button>
          {!sideBySide && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={view}
              onValueChange={(value) => {
                if (value) setView(value as "list" | "map");
              }}
              className="ml-auto"
            >
              <ToggleGroupItem value="list">{t("common.list")}</ToggleGroupItem>
              <ToggleGroupItem value="map">{t("common.map")}</ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
      </header>

      <CategoryChips
        categories={categories}
        spots={spots}
        filter={filter}
        onChange={setFilter}
      />

      <div
        className={cn(
          "flex flex-col gap-4",
          sideBySide &&
            "grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-6",
        )}
      >
        {showList && (
          <div className="flex min-w-0 flex-col gap-8">
            {food === null ? (
              <p className="text-sm text-muted-foreground">
                {t("food.loading")}
              </p>
            ) : (
              groups.map(({ category, spots: inCategory }) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  city={city}
                  hotel={hotel}
                  starredOnly={filter.starredOnly}
                >
                  {inCategory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {filter.starredOnly
                        ? t("food.noStarred")
                        : isResearchRequested(category)
                          ? t("food.researchWaiting")
                          : t("food.noSpots")}
                    </p>
                  ) : (
                    <ul
                      className={cn(
                        "grid gap-3",
                        sideBySide ? "2xl:grid-cols-2" : "sm:grid-cols-2",
                      )}
                    >
                      {inCategory.map((spot) => (
                        <li
                          key={spot.id}
                          ref={(element) => {
                            if (element) cards.current.set(spot.id, element);
                            else cards.current.delete(spot.id);
                          }}
                        >
                          <SpotCard
                            spot={spot}
                            highlighted={highlighted === spot.id}
                            onStar={() =>
                              saveSpot(
                                {
                                  ...spot,
                                  starred: !spot.starred,
                                  updatedAt: new Date().toISOString(),
                                },
                                null,
                              )
                            }
                            onEdit={() => setEditing(spot)}
                            onArchive={() =>
                              saveSpot(
                                {
                                  ...spot,
                                  archived: true,
                                  updatedAt: new Date().toISOString(),
                                },
                                t("common.archivedName", { name: spot.name }),
                                spot,
                              )
                            }
                            onShowOnMap={
                              spot.lat !== null
                                ? () => showOnMap(spot)
                                : undefined
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </CategorySection>
              ))
            )}
          </div>
        )}
        {showMap && (
          <div className={cn(sideBySide && "sticky top-20")}>
            <TripMap
              pins={pins}
              onPinClick={pinClicked}
              focus={focus}
              className={
                sideBySide
                  ? "aspect-[4/5] max-h-[calc(100svh-7rem)]"
                  : "h-[65svh]"
              }
              note={
                unpinned > 0
                  ? t("food.unpinned", { unpinned, total: visible.length })
                  : null
              }
            />
          </div>
        )}
      </div>

      {editing && (
        <SpotForm
          spot={editing === "new" ? null : editing}
          categories={categoryOptions}
          defaultCategoryId={
            filter.categoryId === "all"
              ? categoryOptions[0]?.id
              : filter.categoryId
          }
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            const existing = editing === "new" ? null : editing;
            const taken = new Set((food?.spots ?? []).map((s) => s.id));
            const next = spotFromDraft(
              draft,
              city.id,
              city.name,
              existing,
              taken,
              new Date(),
            );
            setEditing(null);
            saveSpot(
              next,
              existing
                ? t("food.spotSaved", { name: next.name })
                : t("food.spotAdded", { name: next.name }),
            );
          }}
        />
      )}
      <CategoryManager
        open={managing}
        rows={food?.categories ?? []}
        onClose={() => setManaging(false)}
        onSave={saveCategories}
      />
    </div>
  );
}

// The category filter: a sideways row of chips, with the number of spots in
// each, and "Starred" to narrow to the chosen ones.
function CategoryChips({
  categories,
  spots,
  filter,
  onChange,
}: {
  categories: FoodCategory[];
  spots: FoodSpot[];
  filter: Filter;
  onChange: (filter: Filter) => void;
}) {
  const chip = (
    key: string,
    label: string,
    count: number | null,
    pressed: boolean,
    onClick: () => void,
    icon?: ReactNode,
  ) => (
    <button
      key={key}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors hover:bg-muted",
        pressed &&
          "border-primary bg-primary/10 font-medium text-primary hover:bg-primary/15",
      )}
    >
      {icon}
      {label}
      {count !== null && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );
  return (
    <nav
      aria-label={t("food.filterLabel")}
      className="sticky top-14 z-30 -mx-4 flex gap-2 overflow-x-auto bg-background px-4 py-2 lg:top-16 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {chip(
        "starred",
        t("food.starred"),
        spots.filter((s) => s.starred).length,
        filter.starredOnly,
        () => onChange({ ...filter, starredOnly: !filter.starredOnly }),
        <Star aria-hidden className="size-3.5" />,
      )}
      <span aria-hidden className="w-px shrink-0 self-stretch bg-border" />
      {chip(
        "all",
        t("food.all"),
        spots.length,
        filter.categoryId === "all",
        () => onChange({ ...filter, categoryId: "all" }),
      )}
      {categories.map((category) =>
        chip(
          category.id,
          labelOf(category),
          spots.filter((s) => s.categoryId === category.id).length,
          filter.categoryId === category.id,
          () => onChange({ ...filter, categoryId: category.id }),
        ),
      )}
    </nav>
  );
}

function CategorySection({
  category,
  city,
  hotel,
  starredOnly,
  children,
}: {
  category: FoodCategory;
  city: CityRecord;
  hotel: StayRecord | null;
  starredOnly: boolean;
  children: ReactNode;
}) {
  const label = labelOf(category);
  const titleId = `food-${category.id}-title`;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={titleId}
          className="flex items-center gap-2 text-xl font-semibold"
        >
          {label}
          {isResearchRequested(category) && !starredOnly && (
            <Badge variant="outline" className="text-warning">
              <Clock aria-hidden />
              {t("food.requested")}
            </Badge>
          )}
        </h2>
        <a
          href={categorySearchUrl(category, city, hotel)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
        >
          <Search className="size-4" aria-hidden />
          {t("food.searchMaps", { category: label.toLowerCase() })}
        </a>
      </div>
      {children}
    </section>
  );
}

function SpotCard({
  spot,
  highlighted,
  onStar,
  onEdit,
  onArchive,
  onShowOnMap,
}: {
  spot: FoodSpot;
  highlighted: boolean;
  onStar: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onShowOnMap?: () => void;
}) {
  return (
    <article
      aria-label={spot.name}
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-shadow",
        highlighted && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <a
            href={foodSpotMapsUrl(spot)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline"
          >
            {spot.name}
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          </a>
          {spot.nameJa && (
            <p lang="ja" className="text-sm text-muted-foreground">
              {spot.nameJa}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-pressed={spot.starred}
          aria-label={
            spot.starred
              ? t("food.unstar", { name: spot.name })
              : t("food.star", { name: spot.name })
          }
          onClick={onStar}
        >
          <Star className={cn(spot.starred && "fill-current text-warning")} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("food.more", { name: spot.name })}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onShowOnMap && (
              <DropdownMenuItem onSelect={onShowOnMap}>
                <Search />
                {t("food.showOnMap")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil />
              {t("food.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchive}>
              <Archive />
              {t("common.archive")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {spot.area && <Badge variant="outline">{spot.area}</Badge>}
        {spot.priceLevel !== null && (
          <Badge
            variant="outline"
            aria-label={t("food.priceLabel", { level: spot.priceLevel })}
          >
            {"¥".repeat(spot.priceLevel)}
          </Badge>
        )}
        {spot.origin === "member" && (
          <Badge variant="secondary">{t("food.addedByYou")}</Badge>
        )}
      </div>
      {spot.near && (
        <p className="text-xs text-muted-foreground">
          {t("food.near", { place: spot.near })}
        </p>
      )}
      {spot.dish && (
        <p className="text-sm">
          <span className="font-medium">{t("food.tryLabel")}</span> {spot.dish}
        </p>
      )}
      {spot.description && (
        <p className="text-sm leading-relaxed">{spot.description}</p>
      )}
      {spot.tip && (
        <p className="flex gap-1.5 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{spot.tip}</span>
        </p>
      )}
      {(spot.websiteUrl || spot.sources.length > 0) && (
        <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
          {spot.websiteUrl && (
            <a
              href={spot.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {t("common.website")}
            </a>
          )}
          {spot.sources.slice(0, 3).map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="break-all underline underline-offset-2"
            >
              {hostname(url)}
            </a>
          ))}
        </p>
      )}
    </article>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// A bottom Drawer on phones, a side Sheet from lg.
function Panel({
  open,
  title,
  description,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const change = (o: boolean) => !o && onClose();
  if (wide)
    return (
      <Sheet open={open} onOpenChange={change}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <SheetBody>{children}</SheetBody>
          {footer && <SheetFooter>{footer}</SheetFooter>}
        </SheetContent>
      </Sheet>
    );
  return (
    <Drawer open={open} onOpenChange={change}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[60svh] overflow-y-auto px-4">{children}</div>
        {footer && (
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

const NO_PRICE = "none";

function SpotForm({
  spot,
  categories,
  defaultCategoryId,
  onClose,
  onSave,
}: {
  spot: FoodSpot | null;
  categories: FoodCategory[];
  defaultCategoryId: string | undefined;
  onClose: () => void;
  onSave: (draft: FoodSpotDraft) => void;
}) {
  const [draft, setDraft] = useState<FoodSpotDraft>(() =>
    spot
      ? draftFromSpot(spot)
      : {
          name: "",
          categoryId: defaultCategoryId ?? "",
          nameJa: "",
          area: "",
          dish: "",
          description: "",
          tip: "",
          priceLevel: null,
          mapsQuery: "",
          websiteUrl: "",
        },
  );
  const set = (patch: Partial<FoodSpotDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const urlOk =
    draft.websiteUrl.trim() === "" ||
    /^https:\/\/\S+$/.test(draft.websiteUrl.trim());
  const valid = draft.name.trim() !== "" && draft.categoryId !== "" && urlOk;
  const options = categories;

  const text = (
    id: keyof FoodSpotDraft,
    label: string,
    props: { maxLength: number; placeholder?: string; lang?: string },
  ) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`food-${id}`}>{label}</Label>
      <Input
        id={`food-${id}`}
        value={String(draft[id] ?? "")}
        onChange={(e) => set({ [id]: e.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <Panel
      open
      title={
        spot ? t("food.editTitle", { name: spot.name }) : t("food.addTitle")
      }
      description={t("food.formBody")}
      onClose={onClose}
      footer={
        <Button disabled={!valid} onClick={() => onSave(draft)}>
          {t("common.save")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {text("name", t("common.name"), { maxLength: 120 })}
        <div className="flex flex-col gap-2">
          <Label htmlFor="food-category">{t("common.category")}</Label>
          <Select
            value={draft.categoryId}
            onValueChange={(value) => set({ categoryId: value })}
          >
            <SelectTrigger id="food-category" className="w-full">
              <SelectValue placeholder={t("food.chooseCategory")} />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {labelOf(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {text("nameJa", t("food.nameJa"), { maxLength: 80, lang: "ja" })}
        {text("area", t("food.area"), {
          maxLength: 120,
          placeholder: t("food.areaPlaceholder"),
        })}
        {text("dish", t("food.dish"), {
          maxLength: 120,
          placeholder: t("food.dishPlaceholder"),
        })}
        <div className="flex flex-col gap-2">
          <Label htmlFor="food-description">{t("food.description")}</Label>
          <Textarea
            id="food-description"
            value={draft.description}
            maxLength={600}
            rows={3}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
        {text("tip", t("food.tip"), { maxLength: 300 })}
        <div className="flex flex-col gap-2">
          <Label htmlFor="food-price">{t("food.price")}</Label>
          <Select
            value={
              draft.priceLevel === null ? NO_PRICE : String(draft.priceLevel)
            }
            onValueChange={(value) =>
              set({ priceLevel: value === NO_PRICE ? null : Number(value) })
            }
          >
            <SelectTrigger id="food-price" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PRICE}>{t("common.none")}</SelectItem>
              {FOOD_PRICE_LEVELS.map((level) => (
                <SelectItem key={level} value={String(level)}>
                  {"¥".repeat(level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {text("mapsQuery", t("food.mapsQuery"), {
          maxLength: 200,
          placeholder: t("food.mapsQueryPlaceholder"),
        })}
        <div className="flex flex-col gap-2">
          {text("websiteUrl", t("common.website"), {
            maxLength: 500,
            placeholder: "https://",
          })}
          {!urlOk && (
            <p className="text-xs text-destructive">{t("food.badUrl")}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

// The trip's categories: rename, reorder, archive and restore, ask for
// research, and add your own.
function CategoryManager({
  open,
  rows,
  onClose,
  onSave,
}: {
  open: boolean;
  rows: FoodCategory[];
  onClose: () => void;
  onSave: (rows: FoodCategory[], done: string | null) => void;
}) {
  const active = foodCategories(rows);
  const archived = foodCategories(rows, { archived: true }).filter(
    (c) => c.archived,
  );
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [asking, setAsking] = useState<{ id: string; note: string } | null>(
    null,
  );
  const now = () => new Date();

  function add() {
    const name = newName.trim();
    if (!name) return;
    const all = foodCategories(rows, { archived: true });
    onSave(
      [newCustomCategory(name, all, now())],
      t("food.categoryAdded", { name }),
    );
    setNewName("");
  }

  return (
    <Panel
      open={open}
      title={t("food.manageTitle")}
      description={t("food.manageBody")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 pb-4">
        <ul className="flex flex-col divide-y rounded-xl border">
          {active.map((category, index) => {
            const label = labelOf(category);
            return (
              <li key={category.id} className="flex flex-col gap-2 p-3">
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {label}
                  </span>
                  {isResearchRequested(category) && (
                    <Badge variant="outline" className="text-warning">
                      <Clock aria-hidden />
                      {t("food.requested")}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    aria-label={t("food.moveUp", { name: label })}
                    onClick={() =>
                      onSave(moveCategory(active, category.id, -1, now()), null)
                    }
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === active.length - 1}
                    aria-label={t("food.moveDown", { name: label })}
                    onClick={() =>
                      onSave(moveCategory(active, category.id, 1, now()), null)
                    }
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("common.editName", { name: label })}
                    onClick={() =>
                      setRenaming({ id: category.id, name: label })
                    }
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("food.archiveCategory", { name: label })}
                    onClick={() =>
                      onSave(
                        [
                          {
                            ...category,
                            archived: true,
                            updatedAt: now().toISOString(),
                          },
                        ],
                        t("common.archivedName", { name: label }),
                      )
                    }
                  >
                    <Archive />
                  </Button>
                </div>
                {renaming?.id === category.id && (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = renaming.name.trim();
                      if (!name) return;
                      // A built-in name back as it was is no rename.
                      const builtIn =
                        category.key && name === builtInName(category.key);
                      onSave(
                        [
                          {
                            ...category,
                            name: builtIn ? null : name.slice(0, 60),
                            updatedAt: now().toISOString(),
                          },
                        ],
                        null,
                      );
                      setRenaming(null);
                    }}
                  >
                    <Input
                      aria-label={t("food.newName")}
                      value={renaming.name}
                      maxLength={60}
                      onChange={(e) =>
                        setRenaming({ id: category.id, name: e.target.value })
                      }
                    />
                    <Button type="submit" size="sm">
                      {t("common.save")}
                    </Button>
                  </form>
                )}
                {isResearchRequested(category) ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <p className="min-w-0 flex-1">
                      {category.request
                        ? t("food.waitingFor", { request: category.request })
                        : t("food.researchWaiting")}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onSave(
                          [cancelCategoryResearch(category, now())],
                          t("food.researchCancelled"),
                        )
                      }
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                ) : asking?.id === category.id ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      aria-label={t("food.researchNote")}
                      placeholder={t("food.researchPlaceholder")}
                      value={asking.note}
                      maxLength={1000}
                      rows={3}
                      onChange={(e) =>
                        setAsking({ id: category.id, note: e.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          onSave(
                            [
                              requestCategoryResearch(
                                category,
                                asking.note,
                                now(),
                              ),
                            ],
                            t("food.researchRequested"),
                          );
                          setAsking(null);
                        }}
                      >
                        {t("food.sendRequest")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAsking(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto self-start p-0"
                    onClick={() => setAsking({ id: category.id, note: "" })}
                  >
                    <Sparkles data-icon="inline-start" />
                    {t("food.askResearch")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Label htmlFor="food-new-category">{t("food.newCategory")}</Label>
          <div className="flex gap-2">
            <Input
              id="food-new-category"
              value={newName}
              maxLength={60}
              placeholder={t("food.newCategoryPlaceholder")}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" disabled={newName.trim() === ""}>
              <Plus data-icon="inline-start" />
              {t("common.add")}
            </Button>
          </div>
        </form>

        {archived.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t("food.archivedCategories")}
            </p>
            <ul className="flex flex-col gap-1">
              {archived.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{labelOf(category)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onSave(
                        [
                          {
                            ...category,
                            archived: false,
                            order: Math.min(999, active.length),
                            updatedAt: now().toISOString(),
                          },
                        ],
                        null,
                      )
                    }
                  >
                    <Undo2 data-icon="inline-start" />
                    {t("common.restore")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
