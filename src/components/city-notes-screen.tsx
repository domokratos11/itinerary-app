"use client";

import { ArrowLeft, Clock, MessageSquarePlus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
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
import {
  cancelCityRequest,
  citiesInTripOrder,
  CITY_NOTE_SECTIONS,
  requestCityNotes,
  type CityNoteSection,
  type CityNotes,
  type CityNotesContent,
  type CityNotesRepository,
} from "@/domain/city-notes";
import type { Language } from "@/domain/user-repository";
import { cityNotesRepository } from "@/lib/city-notes-repository-instance";
import { formatDateRange, formatTokyoDateTime } from "@/lib/format-day";
import { getLocale, t } from "@/lib/i18n";
import { pageHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import { useTrip } from "@/lib/trip-store";
import { useActiveSection } from "@/lib/use-active-section";
import { useCityNotes } from "@/lib/use-city-notes";
import { useMediaQuery } from "@/lib/use-media-query";
import { useTripId } from "@/lib/use-trip-id";

// /city-notes/ lists the trip's cities in visiting order; /city-notes/?id=
// shows one city's notes. The notes are background, not a guide: history,
// defining moments, traditions, food, the season and the words used. They
// arrive from a research run (docs/city-research.md); the app asks for them
// and shows them in the person's language.
export function CityNotesScreen({
  repository = cityNotesRepository,
}: {
  repository?: CityNotesRepository;
}) {
  const id = useSearchParams().get("id");
  const tripId = useTripId();
  const notes = useCityNotes(tripId, repository);
  return id ? (
    <CityNotesDetail
      cityId={id}
      tripId={tripId}
      notes={notes}
      repository={repository}
    />
  ) : (
    <CityNotesList tripId={tripId} notes={notes} />
  );
}

function CityNotesList({
  tripId,
  notes,
}: {
  tripId: string | null;
  notes: Map<string, CityNotes> | null;
}) {
  const trip = useTrip();
  const language = getLocale();
  const cities = useMemo(
    () => citiesInTripOrder(trip.cities, trip.stays),
    [trip.cities, trip.stays],
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t("cityNotes.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("cityNotes.subtitle")}
        </p>
      </div>
      {cities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("cityNotes.noCities")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cities.map((city) => {
            const row = notes?.get(city.id) ?? null;
            const dates = stayRange(trip.stays, city.id);
            return (
              <li key={city.id}>
                <Link
                  href={pageHref("/city-notes/", tripId, { id: city.id })}
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
                        <StatusBadge row={row} />
                      </CardTitle>
                      {dates && <CardDescription>{dates}</CardDescription>}
                      <CardDescription className="line-clamp-3">
                        {row?.notes
                          ? row.notes.glance[language]
                          : t("cityNotes.noneYet")}
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

function stayRange(
  stays: {
    cityId: string;
    checkIn: string;
    checkOut: string;
    archived: boolean;
  }[],
  cityId: string,
): string | null {
  const mine = stays
    .filter((s) => !s.archived && s.cityId === cityId)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  if (mine.length === 0) return null;
  return formatDateRange(mine[0].checkIn, mine.at(-1)!.checkOut);
}

function StatusBadge({ row }: { row: CityNotes | null }) {
  if (row?.status === "requested")
    return (
      <Badge variant="outline" className="text-warning">
        <Clock aria-hidden />
        {t("cityNotes.statusRequested")}
      </Badge>
    );
  if (row?.notes)
    return <Badge variant="secondary">{t("cityNotes.statusReady")}</Badge>;
  return null;
}

function CityNotesDetail({
  cityId,
  tripId,
  notes,
  repository,
}: {
  cityId: string;
  tripId: string | null;
  notes: Map<string, CityNotes> | null;
  repository: CityNotesRepository;
}) {
  const trip = useTrip();
  const language = getLocale();
  const city = trip.cities.find((c) => c.id === cityId && !c.archived);
  const row = notes?.get(cityId) ?? null;
  const [asking, setAsking] = useState(false);
  const placeIds = useMemo(
    () => new Set(trip.places.filter((p) => !p.archived).map((p) => p.id)),
    [trip.places],
  );

  const back = (
    <Button asChild variant="ghost" size="sm" className="self-start">
      <Link href={pageHref("/city-notes/", tripId)}>
        <ArrowLeft data-icon="inline-start" />
        {t("cityNotes.allCities")}
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

  function save(next: CityNotes, done: string) {
    if (!tripId) return;
    repository
      .save(tripId, next)
      .then(() => toast.success(done))
      .catch(() => toast.error(t("cityNotes.saveFailed")));
  }

  const content = row?.notes ?? null;
  const shown = content ? visibleSections(content) : [];

  return (
    <div className="flex flex-col gap-4">
      {back}
      <header className="flex flex-col gap-2">
        <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
          {city.name}
          <StatusBadge row={row} />
        </h1>
        {content && (
          <p className="text-xs text-muted-foreground">
            {t("cityNotes.researchedAt", {
              when: formatTokyoDateTime(content.researchedAt),
            })}
          </p>
        )}
        {row?.status === "requested" ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1">
              {row.request
                ? t("cityNotes.waitingFor", { request: row.request })
                : t("cityNotes.waiting")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                save(
                  cancelCityRequest(row, new Date()),
                  t("cityNotes.cancelled"),
                )
              }
            >
              {t("cityNotes.cancel")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {!content && (
              <Button
                onClick={() =>
                  save(
                    requestCityNotes(cityId, "", row, new Date()),
                    t("cityNotes.requested"),
                  )
                }
              >
                <Sparkles data-icon="inline-start" />
                {t("cityNotes.request")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setAsking(true)}>
              <MessageSquarePlus data-icon="inline-start" />
              {t("cityNotes.specifics")}
            </Button>
          </div>
        )}
      </header>

      {!content ? (
        <p className="text-sm text-muted-foreground">
          {t("cityNotes.noneYetLong")}
        </p>
      ) : (
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[14rem_1fr] lg:items-start lg:gap-8">
          <SectionNav sections={shown} />
          <div className="flex max-w-3xl min-w-0 flex-col gap-8">
            {shown.map((section) => (
              <Section key={section} id={section}>
                <SectionBody
                  section={section}
                  notes={content}
                  language={language}
                  placeIds={placeIds}
                />
              </Section>
            ))}
          </div>
        </div>
      )}

      <AskSpecifics
        open={asking}
        cityName={city.name}
        onClose={() => setAsking(false)}
        onSend={(message) => {
          setAsking(false);
          save(
            requestCityNotes(cityId, message, row, new Date()),
            t("cityNotes.requested"),
          );
        }}
      />
    </div>
  );
}

// Sections with something in them; "answers" only once a question was
// answered.
function visibleSections(notes: CityNotesContent): CityNoteSection[] {
  return CITY_NOTE_SECTIONS.filter((section) => {
    switch (section) {
      case "glance":
      case "season":
        return true;
      default:
        return notes[section].length > 0;
    }
  });
}

// The section links: a sticky row of chips under the header on phones, a
// sticky list on the left from lg. The section being read is highlighted.
function SectionNav({ sections }: { sections: CityNoteSection[] }) {
  const ids = useMemo(() => sections.map((s) => `city-${s}`), [sections]);
  const [active, select] = useActiveSection(ids);
  const links = useRef(new Map<string, HTMLAnchorElement>());

  useEffect(() => {
    // Keep the highlighted chip in view in the sideways row on phones.
    const link = active ? links.current.get(active) : undefined;
    link?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <nav
      aria-label={t("cityNotes.sectionsLabel")}
      className="sticky top-14 z-30 -mx-4 flex gap-2 overflow-x-auto bg-background px-4 py-2 lg:top-20 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:bg-transparent lg:px-0 lg:py-0"
    >
      {sections.map((section) => {
        const id = `city-${section}`;
        const current = id === active;
        return (
          <a
            key={section}
            ref={(element) => {
              if (element) links.current.set(id, element);
              else links.current.delete(id);
            }}
            href={`#${id}`}
            aria-current={current ? "true" : undefined}
            onClick={() => select(id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors hover:bg-muted lg:rounded-md lg:border-0 lg:border-l-2 lg:border-transparent lg:px-2 lg:py-1.5",
              current &&
                "border-primary bg-primary/10 font-medium text-primary hover:bg-primary/15 lg:border-primary",
            )}
          >
            {t(`cityNotes.sections.${section}`)}
          </a>
        );
      })}
    </nav>
  );
}

function Section({
  id,
  children,
}: {
  id: CityNoteSection;
  children: ReactNode;
}) {
  return (
    <section
      id={`city-${id}`}
      aria-labelledby={`city-${id}-title`}
      className="flex scroll-mt-32 flex-col gap-3 lg:scroll-mt-20"
    >
      <h2 id={`city-${id}-title`} className="text-xl font-semibold">
        {t(`cityNotes.sections.${id}`)}
      </h2>
      {children}
    </section>
  );
}

function SectionBody({
  section,
  notes,
  language,
  placeIds,
}: {
  section: CityNoteSection;
  notes: CityNotesContent;
  language: Language;
  placeIds: ReadonlySet<string>;
}) {
  switch (section) {
    case "glance":
      return <Prose text={notes.glance[language]} />;
    case "season":
      return <Prose text={notes.season[language]} />;
    case "timeline":
      return (
        <ol className="flex flex-col gap-3 border-l pl-4">
          {notes.timeline.map((entry, i) => (
            <li key={i} className="relative">
              <span
                aria-hidden
                className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-primary"
              />
              <p className="text-sm font-semibold">{entry.when}</p>
              <p className="text-sm">{entry.text[language]}</p>
            </li>
          ))}
        </ol>
      );
    case "moments":
      return (
        <ul className="flex flex-col gap-4">
          {notes.moments.map((moment, i) => (
            <li key={i} className="flex flex-col gap-1 rounded-xl border p-4">
              <p className="font-semibold">{moment.title[language]}</p>
              {moment.when && (
                <p className="text-xs text-muted-foreground">{moment.when}</p>
              )}
              <Prose text={moment.text[language]} />
              {moment.places.length > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("cityNotes.whereToSee")}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {moment.places.map((place) => (
                      <li key={place.name}>
                        <Badge variant="outline">
                          {place.name}
                          {place.placeId && placeIds.has(place.placeId) && (
                            <span className="text-primary">
                              {" · "}
                              {t("cityNotes.onTrip")}
                            </span>
                          )}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      );
    case "traditions":
      return (
        <dl className="grid gap-4 sm:grid-cols-2">
          {notes.traditions.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <dt className="font-semibold">{item.name[language]}</dt>
              <dd className="text-sm">{item.text[language]}</dd>
            </div>
          ))}
        </dl>
      );
    case "food":
      return (
        <dl className="grid gap-4 sm:grid-cols-2">
          {notes.food.map((dish, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-xl border p-4">
              <dt className="font-semibold">
                {dish.name[language]}
                {dish.japanese && (
                  <span
                    lang="ja"
                    className="ml-2 font-normal text-muted-foreground"
                  >
                    {dish.japanese}
                  </span>
                )}
              </dt>
              <dd className="text-sm">{dish.text[language]}</dd>
            </div>
          ))}
        </dl>
      );
    case "glossary":
      return (
        <dl className="flex flex-col divide-y rounded-xl border">
          {notes.glossary.map((entry) => (
            <div
              key={entry.term}
              className="flex flex-col gap-0.5 p-3 sm:flex-row sm:gap-4"
            >
              <dt className="shrink-0 font-semibold sm:w-44">
                {entry.term}
                {entry.japanese && (
                  <span
                    lang="ja"
                    className="ml-2 font-normal text-muted-foreground"
                  >
                    {entry.japanese}
                  </span>
                )}
              </dt>
              <dd className="text-sm">{entry.text[language]}</dd>
            </div>
          ))}
        </dl>
      );
    case "answers":
      return (
        <ul className="flex flex-col gap-4">
          {[...notes.answers].reverse().map((item, i) => (
            <li
              key={i}
              className="flex flex-col gap-1 rounded-xl bg-muted/50 p-4"
            >
              <p className="text-sm font-semibold">{item.question}</p>
              <Prose text={item.answer[language]} />
            </li>
          ))}
        </ul>
      );
    case "sources":
      return (
        <ul className="flex flex-col gap-1 text-sm">
          {notes.sources.map((source) => (
            <li key={source.url} className="min-w-0">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="break-words underline underline-offset-2"
              >
                {source.note ?? new URL(source.url).hostname}
              </a>
            </li>
          ))}
        </ul>
      );
  }
}

// Paragraphs split on blank lines.
function Prose({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}

// "Research specifics": a question for the next research run. A bottom
// Drawer on phones, a side Sheet from lg.
function AskSpecifics({
  open,
  cityName,
  onClose,
  onSend,
}: {
  open: boolean;
  cityName: string;
  onClose: () => void;
  onSend: (message: string) => void;
}) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const [message, setMessage] = useState("");
  const title = t("cityNotes.specificsTitle", { city: cityName });
  const description = t("cityNotes.specificsBody");
  const field = (
    <div className="flex flex-col gap-2">
      <Label htmlFor="city-specifics">{t("cityNotes.specificsLabel")}</Label>
      <Textarea
        id="city-specifics"
        value={message}
        maxLength={1000}
        rows={5}
        placeholder={t("cityNotes.specificsPlaceholder")}
        onChange={(e) => setMessage(e.target.value)}
      />
    </div>
  );
  const send = (
    <Button
      disabled={message.trim() === ""}
      onClick={() => {
        onSend(message);
        setMessage("");
      }}
    >
      {t("cityNotes.send")}
    </Button>
  );
  const change = (o: boolean) => !o && onClose();

  if (wide)
    return (
      <Sheet open={open} onOpenChange={change}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <SheetBody>{field}</SheetBody>
          <SheetFooter>{send}</SheetFooter>
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
        <div className="px-4">{field}</div>
        <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {send}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
