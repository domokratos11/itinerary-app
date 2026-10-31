"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  Eraser,
  Globe,
  History,
  Inbox,
  MapPin,
  Search,
  Ticket,
  CalendarOff,
  Route,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ExportTrip } from "@/components/settings-backup";
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
import { Button } from "@/components/ui/button";
import {
  CLEANUP_KINDS,
  planCleanup,
  planEverything,
  type CleanupCollection,
  type CleanupKind,
  type CleanupPlan,
  type RemoteLeftovers,
} from "@/domain/cleanup";
import { logActivity } from "@/lib/activity-log";
import { cleanupRepository } from "@/lib/firestore-cleanup-repository";
import { t } from "@/lib/i18n";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";
import { useProposals } from "@/lib/use-proposals";

const ICONS: Record<CleanupKind, LucideIcon> = {
  stays: BedDouble,
  cities: Globe,
  places: MapPin,
  reservations: Ticket,
  holidays: CalendarOff,
  expenses: Wallet,
  stops: Route,
  research: Search,
};

type Pending =
  | { kind: "plan"; title: string; count: number; plan: CleanupPlan }
  | { kind: "history"; title: string; count: number }
  | { kind: "queue"; title: string; count: number }
  | { kind: "everything"; title: string; count: number; plan: CleanupPlan };

async function removePlan(tripId: string, plan: CleanupPlan) {
  // Children first, so an interrupted run never leaves one without its parent.
  const order: CleanupCollection[] = [
    "items",
    "proposals",
    "places",
    "stays",
    "reservations",
    "holidays",
    "expenses",
    "cities",
  ];
  for (const name of order) {
    const ids = plan.remove[name];
    if (ids?.length) await cleanupRepository.remove(tripId, name, ids);
  }
}

// Settings → Clean up. Archived and removed things can be restored until
// they're cleaned up here; after that they're gone for good.
export function CleanupSettings({ tripId }: { tripId: string }) {
  const trip = useTripStore((s) => s.data);
  const items = usePlanStore((s) => s.items);
  const proposals = useProposals(tripId);
  const [remote, setRemote] = useState<RemoteLeftovers | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);

  const input = useMemo(
    () => ({ trip, items, proposals }),
    [trip, items, proposals],
  );
  const everything = useMemo(() => planEverything(input), [input]);

  const refreshRemote = useCallback(() => {
    cleanupRepository
      .countRemote(tripId)
      .then(setRemote)
      .catch(() => setRemote(null));
  }, [tripId]);

  useEffect(refreshRemote, [refreshRemote]);

  async function run(job: Pending) {
    setPending(null);
    setWorking(true);
    try {
      if (job.kind === "plan" || job.kind === "everything")
        await removePlan(tripId, job.plan);
      if (job.kind === "queue" || job.kind === "everything")
        await cleanupRepository.removeAll(tripId, "queue");
      if (job.kind === "history" || job.kind === "everything")
        await cleanupRepository.removeAll(tripId, "activity");
      logActivity(tripId, {
        kind: "settings",
        targetId: null,
        summary: t("activity.cleanedUp", { what: job.title }),
      });
      toast.success(t("cleanup.done", { count: job.count }));
    } catch {
      toast.error(t("common.refused"));
    } finally {
      setWorking(false);
      refreshRemote();
    }
  }

  const total = everything.count + (remote ? remote.history + remote.queue : 0);

  return (
    <div className="flex max-w-3xl flex-col gap-4 text-sm">
      <p className="text-muted-foreground">{t("cleanup.intro")}</p>
      <ul className="flex flex-col divide-y rounded-lg border">
        {CLEANUP_KINDS.map((kind) => {
          const plan = planCleanup(kind, input);
          const title = t(`cleanup.${kind}`);
          return (
            <Row
              key={kind}
              icon={ICONS[kind]}
              title={title}
              count={plan.count}
              note={
                plan.skipped > 0
                  ? t("cleanup.skipped", { count: plan.skipped })
                  : null
              }
              disabled={working}
              onClean={() =>
                setPending({ kind: "plan", title, count: plan.count, plan })
              }
            />
          );
        })}
        <Row
          icon={History}
          title={t("cleanup.history")}
          count={remote?.history ?? 0}
          note={t("cleanup.historyNote")}
          disabled={working}
          onClean={() =>
            setPending({
              kind: "history",
              title: t("cleanup.history"),
              count: remote?.history ?? 0,
            })
          }
        />
        <Row
          icon={Inbox}
          title={t("cleanup.queue")}
          count={remote?.queue ?? 0}
          note={
            remote && remote.queueWaiting > 0
              ? t("cleanup.queueWaiting", { count: remote.queueWaiting })
              : null
          }
          disabled={working}
          onClean={() =>
            setPending({
              kind: "queue",
              title: t("cleanup.queue"),
              count: remote?.queue ?? 0,
            })
          }
        />
      </ul>
      <div>
        <Button
          variant="destructive"
          disabled={total === 0 || working}
          onClick={() =>
            setPending({
              kind: "everything",
              title: t("cleanup.everything"),
              count: total,
              plan: everything,
            })
          }
        >
          <Eraser />
          {t("cleanup.everything")}
        </Button>
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("cleanup.confirmTitle", { what: pending?.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("cleanup.confirmBody", { count: pending?.count ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <ExportTrip />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => pending && void run(pending)}
            >
              {t("cleanup.deleteForGood")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  count,
  note,
  disabled,
  onClean,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  note: string | null;
  disabled: boolean;
  onClean: () => void;
}) {
  return (
    <li className="flex items-center gap-3 p-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {note && (
          <span className="block text-xs text-muted-foreground">{note}</span>
        )}
      </span>
      <span className="text-muted-foreground tabular-nums">{count}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={count === 0 || disabled}
        onClick={onClean}
      >
        {t("cleanup.clean")}
      </Button>
    </li>
  );
}
