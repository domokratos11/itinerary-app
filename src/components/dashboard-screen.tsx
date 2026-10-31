"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  BedDouble,
  CalendarClock,
  CalendarX,
  Flag,
  Search,
  Ticket,
  TriangleAlert,
} from "lucide-react";

import {
  BudgetGauge,
  BarList,
  ColumnChart,
  DonutChart,
  SeriesLegend,
  StackedColumnChart,
} from "@/components/charts";
import {
  categorySeries,
  GaugeCenter,
  SummaryFigures,
  spentPercent,
  useBudgetFigures,
} from "@/components/budget-screen";
import { personLabel } from "@/components/expense-form";
import { TodayCard } from "@/components/today-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatYen, spendByDay, totalsByPayer } from "@/domain/budget";
import {
  cityFigures,
  hoursLeftInTokyoDay,
  mustsNotPlanned,
  nextReservation,
  nightsWithoutHotel,
  placesByCategory,
  placesByPriority,
  placesToResearch,
  quietDays,
  routeLegs,
  stayTonight,
  stopCounts,
  stopsLeftToday,
  stopsOnClosedDays,
  stopsPerDay,
  tripClock,
  upcomingHolidays,
  type TripClock,
} from "@/domain/dashboard";
import { CATEGORY_COLOR, PRIORITY_COLOR } from "@/domain/taxonomy";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { cityHref, dayHref, pageHref } from "@/lib/links";
import { usePlanStore } from "@/lib/plan-store";
import { CATEGORY_ICON, PRIORITY_ICON } from "@/lib/taxonomy-icons";
import { todayInTokyo } from "@/lib/tokyo-date";
import {
  useCitiesById,
  usePlacesById,
  useTrip,
  useTripDays,
} from "@/lib/trip-store";
import { useProposals } from "@/lib/use-proposals";
import { useTripId } from "@/lib/use-trip-id";

const noopSubscribe = () => () => {};
const FALLBACK_COLOR = "#64748b";

function Tile({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {children}
      </CardContent>
    </Card>
  );
}

function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

// The first tiles: how far away the trip is, or how far along.
function ClockTiles({
  clock,
  stopsLeft,
  plannedDays,
}: {
  clock: TripClock;
  stopsLeft: number;
  plannedDays: number;
}) {
  if (clock.phase === "before")
    return (
      <>
        <Tile
          label={t("dashboard.untilTrip")}
          value={t("dashboard.dayCount", { count: clock.daysUntil })}
        >
          <Hint>
            {t("dashboard.startsOn", { day: formatDayLabel(clock.first) })}
          </Hint>
        </Tile>
        <Tile
          label={t("dashboard.tripLength")}
          value={t("dashboard.dayCount", { count: clock.totalDays })}
        >
          <Progress
            value={(plannedDays / clock.totalDays) * 100}
            className="mt-1 h-2"
            aria-label={t("dashboard.daysWithPlan", {
              count: plannedDays,
              total: clock.totalDays,
            })}
          />
          <Hint>
            {t("dashboard.daysWithPlan", {
              count: plannedDays,
              total: clock.totalDays,
            })}
          </Hint>
        </Tile>
      </>
    );
  if (clock.phase === "during")
    return (
      <>
        <Tile
          label={t("dashboard.tripDay")}
          value={t("dashboard.dayOf", {
            day: clock.dayNumber,
            total: clock.totalDays,
          })}
        >
          <Progress
            value={(clock.dayNumber / clock.totalDays) * 100}
            className="mt-1 h-2"
            aria-label={t("dashboard.dayOf", {
              day: clock.dayNumber,
              total: clock.totalDays,
            })}
          />
          <Hint>{t("dashboard.daysLeft", { count: clock.daysLeft })}</Hint>
        </Tile>
        <Tile
          label={t("dashboard.todayLeft")}
          value={t("dashboard.stopCount", { count: stopsLeft })}
        >
          <Hint>
            {t("dashboard.hoursLeft", {
              count: hoursLeftInTokyoDay(new Date()),
            })}
          </Hint>
        </Tile>
      </>
    );
  if (clock.phase === "after")
    return (
      <Tile
        label={t("dashboard.tripOver")}
        value={t("dashboard.dayCount", { count: clock.totalDays })}
      />
    );
  return null;
}

// The first screen: where the trip stands, from what's already in it.
export function DashboardScreen() {
  const tripId = useTripId();
  const trip = useTrip();
  const days = useTripDays();
  const items = usePlanStore((s) => s.items);
  const placesById = usePlacesById();
  const citiesById = useCitiesById();
  const proposals = useProposals(tripId);
  const today = useSyncExternalStore(noopSubscribe, todayInTokyo, () => null);
  const { summary, categories, expenses } = useBudgetFigures();

  const perDay = useMemo(
    () => stopsPerDay(days, items, placesById),
    [days, items, placesById],
  );
  const figures = useMemo(
    () =>
      cityFigures(
        trip.cities.map((c) => c.id),
        trip.places,
        items,
        trip.stays,
        summary.travellers,
      ),
    [trip.cities, trip.places, trip.stays, items, summary.travellers],
  );

  if (!today) return null;

  if (days.length === 0 && trip.places.length === 0)
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        <Empty>{t("dashboard.empty")}</Empty>
        <Button asChild variant="outline">
          <Link href={pageHref("/settings/", tripId)}>
            {t("dashboard.openSettings")}
          </Link>
        </Button>
      </div>
    );

  const clock = tripClock(today, days);
  const counts = stopCounts(items);
  const totalStops = counts.planned + counts.done + counts.skipped;
  const plannedDays = perDay.filter((d) => d.total > 0).length;
  const musts = mustsNotPlanned(trip.places, items);
  const quiet = quietDays(perDay, today);
  const closed = stopsOnClosedDays(items, placesById, today);
  const holidays = upcomingHolidays(trip.holidays, today);
  const noHotel = nightsWithoutHotel(days, trip.stays);
  const ready = proposals.filter((p) => p.status === "ready").length;
  const toResearch = placesToResearch(trip.places);
  const tonight = stayTonight(trip.stays, today);
  const next = nextReservation(trip.reservations, today);
  const legs = routeLegs(days);
  const payers = totalsByPayer(expenses);
  const spending = spendByDay(expenses, days);
  const percent = spentPercent(summary);

  // "Tue, Dec 15" reads as just the date on a narrow axis.
  const dayTick = (date: string) =>
    formatDayLabel(date).split(", ").at(-1) ?? date;
  const cityColor = (id: string) => citiesById.get(id)?.color ?? FALLBACK_COLOR;
  const cityName = (id: string) => citiesById.get(id)?.name ?? id;
  const usedCities = [...new Set(perDay.flatMap((d) => Object.keys(d.byCity)))];

  const watchOut = [
    ...closed.map(({ item, place }) => ({
      key: `closed-${item.id}`,
      icon: CalendarX,
      text: t("dashboard.closedStop", {
        name: place.name,
        day: formatDayLabel(item.date),
      }),
      href: dayHref(item.date, tripId),
    })),
    ...noHotel.slice(0, 3).map((date) => ({
      key: `hotel-${date}`,
      icon: BedDouble,
      text: t("dashboard.noHotel", { day: formatDayLabel(date) }),
      href: pageHref("/settings/", tripId, { tab: "stays" }),
    })),
    ...holidays.map((h) => ({
      key: `holiday-${h.id}`,
      icon: CalendarClock,
      text: t("dashboard.holiday", {
        name: h.name,
        day: formatDayLabel(h.date),
      }),
      href: dayHref(h.date, tripId),
    })),
    ...(ready > 0
      ? [
          {
            key: "research-ready",
            icon: Search,
            text: t("common.researchToReview", { count: ready }),
            href: pageHref("/settings/", tripId, { tab: "places" }),
          },
        ]
      : []),
    ...(toResearch > 0
      ? [
          {
            key: "to-research",
            icon: TriangleAlert,
            text: t("dashboard.toResearch", { count: toResearch }),
            href: pageHref("/settings/", tripId, { tab: "places" }),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ClockTiles
          clock={clock}
          stopsLeft={stopsLeftToday(items, today)}
          plannedDays={plannedDays}
        />
        <Tile
          label={
            summary.over > 0 ? t("budget.overBy") : t("dashboard.budgetLeft")
          }
          value={
            summary.over > 0
              ? formatYen(summary.over)
              : summary.left === null
                ? t("budget.notSet")
                : formatYen(summary.left)
          }
        >
          <Hint>
            {t("dashboard.spentSoFar", { yen: formatYen(summary.spent) })}
          </Hint>
        </Tile>
        <Tile
          label={t("dashboard.stops")}
          value={t("dashboard.doneOf", {
            done: counts.done,
            total: totalStops,
          })}
        >
          <Hint>
            {t("dashboard.placesAndMusts", {
              places: trip.places.length,
              musts: musts.length,
            })}
          </Hint>
        </Tile>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <TodayCard />
        <Panel title={t("dashboard.nextUp")}>
          <ul className="flex flex-col gap-3 text-sm">
            {clock.phase === "during" && (
              <li className="flex items-start gap-2">
                <BedDouble className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    {t("dashboard.tonight")}
                  </span>
                  {tonight ? tonight.hotelName : t("dashboard.noHotelTonight")}
                </span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <Ticket className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">
                  {t("dashboard.nextBooking")}
                </span>
                {next ? (
                  <>
                    {t(`reservationType.${next.type}`)} ·{" "}
                    {formatDayLabel(next.date)}
                    {next.time && ` · ${next.time}`}
                    {next.from && next.to && (
                      <span className="block text-muted-foreground">
                        {next.from} → {next.to}
                      </span>
                    )}
                  </>
                ) : (
                  t("dashboard.noBooking")
                )}
              </span>
            </li>
          </ul>
        </Panel>
        <Panel title={t("dashboard.watchOut")}>
          {watchOut.length === 0 ? (
            <Empty>{t("dashboard.allClear")}</Empty>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {watchOut.map(({ key, icon: Icon, text, href }) => (
                <li key={key}>
                  <Link
                    href={href}
                    className="flex items-start gap-2 underline-offset-2 hover:underline"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">{text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <h2 className="pt-2 text-lg font-semibold">{t("dashboard.money")}</h2>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <Panel title={t("budget.overview")}>
          <div className="grid items-center gap-4 sm:grid-cols-2">
            <BudgetGauge
              percent={percent}
              over={summary.over > 0}
              label={t("budget.gaugeLabel", { percent: Math.round(percent) })}
            >
              <GaugeCenter summary={summary} />
            </BudgetGauge>
            <SummaryFigures summary={summary} />
          </div>
        </Panel>
        <Panel title={t("budget.byCategory")}>
          {summary.spent === 0 ? (
            <Empty>{t("budget.nothingPaid")}</Empty>
          ) : (
            <DonutChart
              series={categorySeries(categories)}
              center={formatYen(summary.spent)}
              centerLabel={t("budget.spent")}
              label={t("budget.byCategory")}
              format={formatYen}
            />
          )}
        </Panel>
        <Panel title={t("dashboard.spendPerDay")}>
          {spending.days.every((d) => d.paid === 0) ? (
            <Empty>{t("dashboard.noDaySpend")}</Empty>
          ) : (
            <ColumnChart
              data={spending.days.map((d) => ({
                key: d.date,
                value: d.paid,
              }))}
              color="#2563eb"
              name={t("budget.spent")}
              label={t("dashboard.spendPerDay")}
              tick={dayTick}
              format={formatYen}
            />
          )}
          {spending.outside > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              {t("dashboard.paidOutside", {
                yen: formatYen(spending.outside),
              })}
            </p>
          )}
        </Panel>
        <Panel title={t("budget.byPerson")}>
          {payers.length === 0 ? (
            <Empty>{t("budget.nothingPaid")}</Empty>
          ) : (
            <BarList
              rows={payers.map((p) => ({
                key: p.paidBy ?? "nobody",
                label: personLabel(p.paidBy),
                value: p.paid,
                color: "var(--primary)",
              }))}
              format={formatYen}
            />
          )}
        </Panel>
      </div>

      <h2 className="pt-2 text-lg font-semibold">{t("dashboard.plan")}</h2>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <Panel
          title={t("dashboard.stopsPerDay")}
          className="md:col-span-2 2xl:col-span-2"
        >
          {totalStops === 0 ? (
            <Empty>{t("dashboard.noStops")}</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              <StackedColumnChart
                data={perDay.map((d) => ({ key: d.date, ...d.byCity }))}
                series={usedCities.map((id) => ({
                  key: id,
                  label: cityName(id),
                  color: cityColor(id),
                }))}
                label={t("dashboard.stopsPerDay")}
                tick={dayTick}
              />
              <SeriesLegend
                series={usedCities.map((id) => ({
                  key: id,
                  label: cityName(id),
                  color: cityColor(id),
                  value: perDay.reduce((n, d) => n + (d.byCity[id] ?? 0), 0),
                }))}
              />
            </div>
          )}
        </Panel>
        <Panel title={t("dashboard.stopStatus")}>
          <SeriesLegend
            series={[
              {
                key: "planned",
                label: t("dashboard.statusPlanned"),
                value: counts.planned,
                color: "#2563eb",
              },
              {
                key: "done",
                label: t("common.done"),
                value: counts.done,
                color: "#16a34a",
              },
              {
                key: "skipped",
                label: t("common.skipped"),
                value: counts.skipped,
                color: "#78716c",
              },
            ]}
          />
          <p className="pt-3 text-xs text-muted-foreground">
            {t("dashboard.quietDays", { count: quiet.length })}
          </p>
        </Panel>
        <Panel title={t("dashboard.mustsNotPlanned")}>
          {musts.length === 0 ? (
            <Empty>{t("dashboard.allMustsPlanned")}</Empty>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {musts.slice(0, 8).map((place) => (
                <li key={place.id}>
                  <Link
                    href={pageHref("/city/", tripId, {
                      id: place.cityId,
                      place: place.id,
                    })}
                    className="flex items-center gap-2 underline-offset-2 hover:underline"
                  >
                    <Flag
                      className="size-4 shrink-0"
                      style={{ color: PRIORITY_COLOR.must }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {place.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {cityName(place.cityId)}
                    </span>
                  </Link>
                </li>
              ))}
              {musts.length > 8 && (
                <li className="text-xs text-muted-foreground">
                  {t("dashboard.andMore", { count: musts.length - 8 })}
                </li>
              )}
            </ul>
          )}
        </Panel>
      </div>

      <h2 className="pt-2 text-lg font-semibold">{t("dashboard.places")}</h2>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <Panel title={t("dashboard.placesByCategory")}>
          {trip.places.length === 0 ? (
            <Empty>{t("cities.noPlaces")}</Empty>
          ) : (
            <DonutChart
              series={placesByCategory(trip.places).map((c) => ({
                key: c.category,
                label: t(`category.${c.category}`),
                value: c.count,
                color: CATEGORY_COLOR[c.category],
                icon: CATEGORY_ICON[c.category],
              }))}
              center={String(trip.places.length)}
              centerLabel={t("dashboard.placesWord")}
              label={t("dashboard.placesByCategory")}
            />
          )}
        </Panel>
        <Panel title={t("dashboard.placesByPriority")}>
          <BarList
            rows={placesByPriority(trip.places).map((p) => ({
              key: p.priority,
              label: t(`priorities.${p.priority}`),
              value: p.count,
              color: PRIORITY_COLOR[p.priority],
              icon: PRIORITY_ICON[p.priority],
            }))}
          />
        </Panel>
        <Panel title={t("dashboard.placesPerCity")}>
          <BarList
            rows={figures.map((f) => ({
              key: f.cityId,
              label: cityName(f.cityId),
              value: f.places,
              color: cityColor(f.cityId),
            }))}
          />
        </Panel>
        <Panel title={t("dashboard.costPerCity")}>
          <BarList
            rows={figures.map((f) => ({
              key: f.cityId,
              label: cityName(f.cityId),
              value: f.estimateYen,
              color: cityColor(f.cityId),
            }))}
            format={formatYen}
          />
        </Panel>
        <Panel
          title={t("dashboard.route")}
          className="md:col-span-2 2xl:col-span-2"
        >
          {legs.length === 0 ? (
            <Empty>{t("dashboard.noRoute")}</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
                {legs.map((leg, index) => (
                  <Link
                    key={`${leg.cityId}-${index}`}
                    href={cityHref(leg.cityId, tripId)}
                    aria-label={cityName(leg.cityId)}
                    title={t("dashboard.legTitle", {
                      city: cityName(leg.cityId),
                      count: leg.days,
                    })}
                    style={{
                      flexGrow: leg.days,
                      backgroundColor: cityColor(leg.cityId),
                    }}
                  />
                ))}
              </div>
              <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {figures.map((f) => (
                  <li key={f.cityId} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cityColor(f.cityId) }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {cityName(f.cityId)}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {t("stays.nights", { count: f.nights })} ·{" "}
                      {t("cities.inPlan", { count: f.inPlan })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
