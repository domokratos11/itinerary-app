"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lightbulb,
  MessageCircleQuestion,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { Tip } from "@/components/tip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  dayProposals,
  isOpenDayResearch,
  requestDay,
} from "@/domain/day-research";
import { mapsSearchUrl } from "@/domain/place-edit";
import { researchToAccept, type ResearchToAccept } from "@/domain/proposals";
import type {
  DayAnalysis,
  DayLoad,
  DayResearch,
  PlaceRecord,
} from "@/domain/schemas";
import type { MessageKey } from "@/domain/i18n";
import { dayResearchRepository } from "@/lib/day-research-repository-instance";
import { formatTokyoDateTime } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { pageHref } from "@/lib/links";
import {
  applyProposals,
  requestResearch,
  undoProposals,
} from "@/lib/proposal-actions";
import { useDayResearch } from "@/lib/use-day-research";
import { useProposals } from "@/lib/use-proposals";
import { useTripId } from "@/lib/use-trip-id";
import { cn } from "@/lib/utils";
import { useReadOnly } from "@/lib/viewer-store";

const LOAD_LABEL: Record<DayLoad, MessageKey> = {
  light: "dayResearch.loadLight",
  medium: "dayResearch.loadMedium",
  heavy: "dayResearch.loadHeavy",
};

const LOAD_STYLE: Record<DayLoad, string> = {
  light:
    "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  medium:
    "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  heavy: "border-red-600/40 bg-red-600/10 text-red-800 dark:text-red-300",
};

const WARNING_LABEL: Record<
  DayAnalysis["warnings"][number]["kind"],
  MessageKey
> = {
  closed: "dayResearch.warningClosed",
  conflict: "dayResearch.warningConflict",
  timing: "dayResearch.warningTiming",
  other: "dayResearch.warningOther",
};

// The research of one day: asking for it (with an optional question), the
// wait, and the analysis once a research run has filled it in. Asking also
// requests research for every place on the day, whatever it already has.
export function DayResearchPanel({
  date,
  placesOfDay,
  placesById,
  onOpenPlace,
}: {
  date: string;
  placesOfDay: PlaceRecord[];
  placesById: Map<string, PlaceRecord>;
  onOpenPlace: (id: string) => void;
}) {
  const tripId = useTripId();
  const readOnly = useReadOnly();
  const rows = useDayResearch(readOnly ? null : tripId);
  const proposals = useProposals(readOnly ? null : tripId);
  const row = rows.find((r) => r.date === date) ?? null;
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(true);
  const [accepting, setAccepting] = useState<ResearchToAccept[] | null>(null);

  const toAccept = useMemo(
    () =>
      researchToAccept(dayProposals(proposals, placesOfDay), placesOfDay, t),
    [proposals, placesOfDay],
  );

  if (readOnly || !tripId) return null;

  async function send(message: string) {
    if (!tripId) return;
    setAsking(false);
    try {
      await dayResearchRepository.save(
        tripId,
        requestDay(date, message, row, new Date()),
      );
      await requestResearch(tripId, placesOfDay, proposals);
      toast(t("dayResearch.saved"));
    } catch {
      toast.error(t("common.refused"));
    }
  }

  function cancel(current: DayResearch) {
    if (!tripId) return;
    const stamp = new Date().toISOString();
    // With an earlier analysis the day goes back to it; otherwise it's set
    // aside for Clean up.
    const next: DayResearch = current.analysis
      ? { ...current, status: "ready", updatedAt: stamp }
      : { ...current, status: "archived", updatedAt: stamp };
    dayResearchRepository
      .save(tripId, next)
      .catch(() => toast.error(t("common.refused")));
    toast(t("dayResearch.cancelled"), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          dayResearchRepository
            .save(tripId, current)
            .catch(() => toast.error(t("common.undoFailed"))),
      },
    });
  }

  function accept(research: ResearchToAccept[]) {
    if (!tripId) return;
    setAccepting(null);
    applyProposals(tripId, research).catch(() =>
      toast.error(t("common.refused")),
    );
    toast(t("placeSettings.acceptedCount", { count: research.length }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          undoProposals(tripId, research).catch(() =>
            toast.error(t("common.undoFailed")),
          ),
      },
    });
  }

  const pending = isOpenDayResearch(row);
  const analysis = row && row.status !== "archived" ? row.analysis : null;
  const askButton = (
    <Tip label={t("dayResearch.tipRequest")}>
      <Button size="sm" variant="outline" onClick={() => setAsking(true)}>
        <Sparkles />
        {analysis ? t("dayResearch.again") : t("dayResearch.request")}
      </Button>
    </Tip>
  );

  return (
    <>
      {!pending && !analysis && <div>{askButton}</div>}

      {pending && row && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-sm">
          <p className="flex items-start gap-2">
            <Search className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              {t("dayResearch.requested", {
                date: formatTokyoDateTime(row.requestedAt),
              })}
            </span>
          </p>
          {row.request && (
            <p className="text-muted-foreground">
              {t("dayResearch.yourMessage", { message: row.request })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAsking(true)}>
              {t("dayResearch.edit")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => cancel(row)}>
              {t("dayResearch.cancel")}
            </Button>
          </div>
        </div>
      )}

      {analysis && (
        <Card size="sm" className="gap-3">
          <CardHeader className="flex flex-row flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              {t("dayResearch.title")}
            </CardTitle>
            <Badge
              variant="outline"
              className={cn("font-medium", LOAD_STYLE[analysis.load])}
            >
              {t(LOAD_LABEL[analysis.load])}
            </Badge>
            {analysis.warnings.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="size-3" />
                {analysis.warnings.length}
              </Badge>
            )}
            <span className="ml-auto flex items-center gap-1">
              {!pending && askButton}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-expanded={open}
                aria-label={
                  open ? t("dayResearch.hide") : t("dayResearch.show")
                }
                onClick={() => setOpen(!open)}
              >
                {open ? <ChevronUp /> : <ChevronDown />}
              </Button>
            </span>
          </CardHeader>
          {open && (
            <CardContent className="flex flex-col gap-4 text-sm">
              <p className="text-muted-foreground">{analysis.loadReason}</p>
              <p className="whitespace-pre-line">{analysis.summary}</p>

              {analysis.warnings.length > 0 && (
                <Section title={t("dayResearch.warnings")} icon={AlertTriangle}>
                  <ul className="flex flex-col gap-2">
                    {analysis.warnings.map((warning, i) => (
                      <li
                        key={i}
                        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2"
                      >
                        <span className="font-medium">
                          {t(WARNING_LABEL[warning.kind])}:
                        </span>{" "}
                        {warning.text}
                        <PlaceLinks
                          ids={warning.placeIds}
                          placesById={placesById}
                          onOpenPlace={onOpenPlace}
                        />
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {analysis.hints.length > 0 && (
                <Section title={t("dayResearch.hints")} icon={Lightbulb}>
                  <ul className="flex flex-col gap-2">
                    {analysis.hints.map((hint, i) => {
                      const place = hint.placeId
                        ? placesById.get(hint.placeId)
                        : undefined;
                      return (
                        <li key={i} className="flex flex-col gap-0.5">
                          {place ? (
                            <button
                              type="button"
                              className="w-fit text-left font-medium underline-offset-4 hover:underline"
                              onClick={() => onOpenPlace(place.id)}
                            >
                              {place.name}
                            </button>
                          ) : (
                            <a
                              href={hint.mapsUrl ?? mapsSearchUrl(hint.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex w-fit items-center gap-1 font-medium underline-offset-4 hover:underline"
                            >
                              {hint.name}
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                          <span className="text-muted-foreground">
                            {hint.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Section>
              )}

              {analysis.answer && (
                <Section
                  title={t("dayResearch.answer")}
                  icon={MessageCircleQuestion}
                >
                  {row?.request && (
                    <p className="text-muted-foreground italic">
                      {row.request}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{analysis.answer}</p>
                </Section>
              )}

              {toAccept.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2">
                  <span className="flex-1">
                    {t("dayResearch.placeUpdates", { count: toAccept.length })}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={pageHref("/settings/", tripId, { tab: "places" })}
                    >
                      {t("dayResearch.review")}
                    </Link>
                  </Button>
                  <Button size="sm" onClick={() => setAccepting(toAccept)}>
                    {t("dayResearch.acceptAll")}
                  </Button>
                </div>
              )}

              <footer className="flex flex-col gap-1 text-xs text-muted-foreground">
                <span>
                  {t("dayResearch.researchedOn", {
                    date: formatTokyoDateTime(analysis.researchedAt),
                  })}
                </span>
                {analysis.sources.length > 0 && (
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {analysis.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {source.note ?? new URL(source.url).hostname}
                      </a>
                    ))}
                  </span>
                )}
              </footer>
            </CardContent>
          )}
        </Card>
      )}

      {asking && (
        <AskForm
          initial={row?.status === "archived" ? "" : (row?.request ?? "")}
          onCancel={() => setAsking(false)}
          onSend={send}
        />
      )}

      <AlertDialog
        open={accepting !== null}
        onOpenChange={(next) => !next && setAccepting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dayResearch.acceptTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dayResearch.acceptBody", { count: accepting?.length ?? 0 })}{" "}
              {(accepting ?? []).some((r) => r.corrections > 0) &&
                t("dayResearch.acceptCorrections", {
                  count: (accepting ?? []).reduce(
                    (n, r) => n + r.corrections,
                    0,
                  ),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => accepting && accept(accepting)}>
              {t("dayResearch.acceptAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AskForm({
  initial,
  onCancel,
  onSend,
}: {
  initial: string;
  onCancel: () => void;
  onSend: (message: string) => void;
}) {
  const [message, setMessage] = useState(initial);
  return (
    <EditPanel
      open
      onOpenChange={(next) => !next && onCancel()}
      title={t("dayResearch.dialogTitle")}
      description={t("dayResearch.dialogBody")}
      submitLabel={t("dayResearch.send")}
      onSubmit={() => onSend(message)}
    >
      <Field
        label={t("dayResearch.messageLabel")}
        htmlFor="day-research-message"
      >
        <Textarea
          id="day-research-message"
          value={message}
          maxLength={1000}
          rows={4}
          placeholder={t("dayResearch.messagePlaceholder")}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
    </EditPanel>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Lightbulb;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function PlaceLinks({
  ids,
  placesById,
  onOpenPlace,
}: {
  ids: string[];
  placesById: Map<string, PlaceRecord>;
  onOpenPlace: (id: string) => void;
}) {
  const places = ids.flatMap((id) => {
    const place = placesById.get(id);
    return place ? [place] : [];
  });
  if (places.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {places.map((place) => (
        <button
          key={place.id}
          type="button"
          className="rounded-full border bg-background px-2 py-0.5 text-xs hover:bg-muted"
          onClick={() => onOpenPlace(place.id)}
        >
          {place.name}
        </button>
      ))}
    </span>
  );
}
