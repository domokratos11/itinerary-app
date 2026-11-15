"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, Loader2, TriangleAlert, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { EditPanel } from "@/components/edit-panel";
import { TripSummaryText } from "@/components/trip-switcher";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { addDays } from "@/domain/days";
import { isEmptyTrip } from "@/domain/trip";
import {
  availableParts,
  copiesAnything,
  copyTrip,
  neededBy,
  sourceFirstDay,
  withNeeds,
  type CopyPart,
  type CopyReport,
  type CopySource,
  type CopyTarget,
  type OutsideRecord,
} from "@/domain/trip-copy";
import type { TripSummary } from "@/domain/trip-repository";
import { useActiveTrip, useAuthStore } from "@/lib/auth-store";
import { formatDateRange, formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { usePlanStore } from "@/lib/plan-store";
import { readCopySource, writeTripCopy } from "@/lib/trip-copy-actions";
import { useTripStore } from "@/lib/trip-store";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

// What a finished copy brought, for the wizard's summary.
export type CopyDone = { sourceName: string; report: CopyReport };

// The person's other itineraries: what can be copied from.
export function useCopySources(tripId: string): TripSummary[] {
  const trips = useAuthStore((s) => s.trips);
  return useMemo(
    () => (trips ?? []).filter((trip) => trip.id !== tripId),
    [trips, tripId],
  );
}

// Whether there is another itinerary to copy from.
export function useCanCopy(tripId: string): boolean {
  return useCopySources(tripId).length > 0;
}

// One line per part with something in it, e.g. "3 cities".
export function copyCounts(report: CopyReport): string[] {
  return report.parts.flatMap((part) => {
    const count = report.counts[part];
    if (count === 0 && !(part === "todos" && report.lists > 0)) return [];
    return [t(`copyTrip.count.${part}`, { count, lists: report.lists })];
  });
}

// "3 cities, 2 hotels", to sit after "From Japan: ".
export function copySummary({ sourceName, report }: CopyDone): string {
  const what = copyCounts(report)
    .map((line) => line.charAt(0).toLocaleLowerCase() + line.slice(1))
    .join(", ");
  return t("copyTrip.copiedSummary", { name: sourceName, what });
}

function outsideLabel(record: OutsideRecord): string {
  const name =
    record.name ??
    (record.reservationType
      ? t(`reservationType.${record.reservationType}`)
      : record.id);
  return `${t(`copyTrip.part.${record.part}`)} · ${name} · ${formatDayLabel(record.date)}`;
}

function ShiftLine({
  source,
  report,
}: {
  source: CopySource;
  report: CopyReport;
}) {
  const first = sourceFirstDay(source);
  if (!first) return <p>{t("copyTrip.noFirstDay")}</p>;
  if (report.shift === 0) return <p>{t("copyTrip.shiftNone")}</p>;
  const values = {
    days: Math.abs(report.shift),
    from: formatDayLabel(first),
    to: formatDayLabel(addDays(first, report.shift)),
  };
  return (
    <p>
      {report.shift > 0
        ? t("copyTrip.shiftLater", values)
        : t("copyTrip.shiftEarlier", values)}
    </p>
  );
}

// "Copy from another itinerary": a card beside "Start empty" in the setup
// wizard, a button in Settings → Backup. It opens a panel to pick the other
// itinerary (only read, never changed) and what to bring, shows what would
// be copied and what would land outside this itinerary's dates, then
// copies. Only into an empty itinerary, as a backup, so nothing is
// overwritten; needs a connection.
export function CopyItinerary({
  tripId,
  trigger,
  onCopied,
  onOpenChange,
}: {
  tripId: string;
  trigger: "card" | "button";
  onCopied?: (done: CopyDone) => void;
  // Told when the panel opens and closes, so a parent can keep it shown
  // while the copy fills the itinerary.
  onOpenChange?: (open: boolean) => void;
}) {
  const sources = useCopySources(tripId);
  const trip = useActiveTrip();
  const me = useAuthStore((s) => s.user?.email ?? "");
  const data = useTripStore((s) => s.data);
  const items = usePlanStore((s) => s.items);
  const empty = isEmptyTrip(data, items);
  const online = useOnline();
  const [open, setOpenState] = useState(false);
  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [source, setSource] = useState<CopySource | null>(null);
  const [readState, setReadState] = useState<"idle" | "reading" | "failed">(
    "idle",
  );
  const [chosen, setChosen] = useState<CopyPart[]>([]);
  const [busy, setBusy] = useState(false);
  const reads = useRef(0);

  const picked = sources.find((s) => s.id === sourceId) ?? null;
  const target: CopyTarget = {
    startDate: trip?.startDate ?? null,
    endDate: trip?.endDate ?? null,
    members: trip?.members ?? [],
    budget: trip?.budget ?? null,
    me,
  };

  // The chosen itinerary is read once, when it is picked. A slower answer
  // for one picked before is dropped.
  function pick(summary: TripSummary) {
    const read = ++reads.current;
    setSourceId(summary.id);
    setSource(null);
    setReadState("reading");
    readCopySource(summary)
      .then((next) => {
        if (read !== reads.current) return;
        setSource(next);
        setReadState("idle");
      })
      .catch(() => read === reads.current && setReadState("failed"));
  }

  const available = source ? availableParts(source, target) : [];
  const parts = withNeeds(chosen.filter((part) => available.includes(part)));
  const report = source ? copyTrip(source, parts, target).report : null;
  const all = source ? copyTrip(source, available, target).report : null;
  const ready =
    online && empty && !busy && report !== null && copiesAnything(report);

  function show() {
    setChosen([]);
    setSourceId(null);
    setSource(null);
    setReadState("idle");
    setOpen(true);
    if (sources.length === 1) pick(sources[0]);
  }

  function toggle(part: CopyPart, on: boolean) {
    setChosen((current) =>
      on
        ? withNeeds([...current, part])
        : current.filter((p) => p !== part && !neededBy(part).includes(p)),
    );
  }

  async function copy() {
    if (!source || !picked || !ready) return;
    const name = picked.name ?? t("common.myTrip");
    // Worked out again now, so every record carries the time it was written.
    const done = copyTrip(source, parts, target);
    setBusy(true);
    try {
      await writeTripCopy(tripId, done, name);
    } catch {
      setBusy(false);
      toast.error(t("copyTrip.failed"));
      return;
    }
    setBusy(false);
    setOpen(false);
    toast.success(t("copyTrip.copied", { name }));
    onCopied?.({ sourceName: name, report: done.report });
  }

  const blocked = !online
    ? t("copyTrip.offline")
    : !empty && !busy
      ? t("copyTrip.notEmpty")
      : null;

  return (
    <>
      {trigger === "card" ? (
        <Button
          type="button"
          variant="outline"
          className="h-auto flex-col items-start gap-1 p-4 text-left whitespace-normal"
          onClick={show}
        >
          <span className="flex items-center gap-2 font-medium">
            <Copy />
            {t("copyTrip.title")}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {t("copyTrip.hint")}
          </span>
        </Button>
      ) : (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={show}>
            <Copy />
            {t("copyTrip.choose")}
          </Button>
        </div>
      )}
      {open && (
        <EditPanel
          open
          onOpenChange={(next) => !busy && setOpen(next)}
          title={t("copyTrip.title")}
          description={t("copyTrip.description")}
          submitLabel={busy ? t("copyTrip.copying") : t("copyTrip.copy")}
          canSubmit={ready}
          onSubmit={() => void copy()}
        >
          <div className="flex flex-col gap-4 text-sm">
            {blocked && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-muted-foreground"
              >
                {!online && <WifiOff aria-hidden className="mt-0.5 size-4" />}
                {blocked}
              </p>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-medium">
                {t("copyTrip.source")}
              </legend>
              <ul className="flex flex-col gap-2">
                {sources.map((s) => (
                  <li key={s.id}>
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={s.id === sourceId}
                      onClick={() => s.id !== sourceId && pick(s)}
                      className={cn(
                        "h-auto w-full justify-start p-3 whitespace-normal",
                        s.id === sourceId &&
                          "border-primary bg-primary/5 ring-1 ring-primary",
                      )}
                    >
                      <TripSummaryText trip={s} />
                    </Button>
                  </li>
                ))}
              </ul>
            </fieldset>

            {readState === "reading" && (
              <p
                role="status"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Loader2 aria-hidden className="size-4 animate-spin" />
                {t("copyTrip.reading")}
              </p>
            )}
            {readState === "failed" && (
              <p role="alert" className="text-destructive">
                {t("copyTrip.readFailed")}
              </p>
            )}

            {source && all && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 font-medium">
                  {t("copyTrip.what")}
                </legend>
                <ul className="flex flex-col gap-2">
                  {available.map((part) => {
                    const id = `copy-part-${part}`;
                    const count = copyCounts({
                      ...all,
                      parts: [part],
                    })[0];
                    return (
                      <li
                        key={part}
                        className="flex gap-3 rounded-lg border p-3"
                      >
                        <Checkbox
                          id={id}
                          checked={parts.includes(part)}
                          onCheckedChange={(on) => toggle(part, on === true)}
                          className="mt-0.5"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <label htmlFor={id} className="font-medium">
                            {t(`copyTrip.part.${part}`)}
                          </label>
                          {count && (
                            <span className="text-muted-foreground">
                              {count}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {t(`copyTrip.partHint.${part}`)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            {source && report && (
              <section
                aria-labelledby="copy-preview"
                className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3"
              >
                <h3 id="copy-preview" className="font-medium">
                  {t("copyTrip.preview")}
                </h3>
                {copiesAnything(report) ? (
                  <>
                    <ul className="list-disc pl-5">
                      {copyCounts(report).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <ShiftLine source={source} report={report} />
                    {report.membersLeftOut > 0 && (
                      <p>
                        {t("copyTrip.membersLeftOut", {
                          count: report.membersLeftOut,
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {t("copyTrip.chooseSome")}
                  </p>
                )}
                {report.outside.length > 0 &&
                  target.startDate &&
                  target.endDate && (
                    <div className="flex flex-col gap-1">
                      <h4 className="flex items-center gap-1.5 font-medium">
                        <TriangleAlert aria-hidden className="size-4" />
                        {t("copyTrip.outsideTitle")}
                      </h4>
                      <p className="text-muted-foreground">
                        {t("copyTrip.outsideBody", {
                          count: report.outside.length,
                          range: formatDateRange(
                            target.startDate,
                            target.endDate,
                          ),
                        })}
                      </p>
                      <ul className="max-h-40 overflow-y-auto">
                        {report.outside.map((record) => (
                          <li key={`${record.part}-${record.id}`}>
                            {outsideLabel(record)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </section>
            )}

            {busy && (
              <p
                role="status"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Loader2 aria-hidden className="size-4 animate-spin" />
                {t("copyTrip.copying")}
              </p>
            )}
          </div>
        </EditPanel>
      )}
    </>
  );
}
