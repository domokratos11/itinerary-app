"use client";

import { CircleCheck, CircleAlert, CloudOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TripRepository } from "@/domain/trip-repository";
import { useAuthStore } from "@/lib/auth-store";
import { t } from "@/lib/i18n";
import { formatSyncAge, useSyncAge } from "@/lib/last-sync";
import {
  precacheStatus,
  updateServiceWorker,
  type PrecacheStatus,
} from "@/lib/offline-check";
import {
  requestPersistentStorage,
  storageStatus,
  type StorageStatus,
} from "@/lib/storage-persist";
import { tripRepository } from "@/lib/trip-repository-instance";
import { useOnline } from "@/lib/use-online";

type Level = "ok" | "warn" | "off";

// What this device can do without signal, and a button to make sure. The
// app saves the trip on the device by itself whenever it is open online; the
// button reads everything from the server once more, fetches a newer build
// if there is one and checks every page is stored.
export function OfflineReadiness({
  repository = tripRepository,
}: {
  repository?: TripRepository;
}) {
  const tripId = useAuthStore((s) => s.tripId);
  const online = useOnline();
  const age = useSyncAge();
  const [pages, setPages] = useState<PrecacheStatus | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const look = useCallback(
    () =>
      Promise.all([precacheStatus(), storageStatus()]).then(([p, s]) => {
        setPages(p);
        setStorage(s);
      }),
    [],
  );

  useEffect(() => {
    let live = true;
    void Promise.all([precacheStatus(), storageStatus()]).then(([p, s]) => {
      if (!live) return;
      setPages(p);
      setStorage(s);
    });
    return () => {
      live = false;
    };
  }, []);

  async function refresh() {
    if (!tripId) return;
    setBusy(true);
    try {
      setStorage(await requestPersistentStorage());
      const count = await repository.refreshFromServer(tripId);
      await updateServiceWorker();
      await look();
      toast.success(t("offline.refreshed", { count }));
    } catch {
      toast.error(t("offline.refreshFailed"));
    } finally {
      setBusy(false);
    }
  }

  const pagesLevel: Level =
    pages === null || !pages.worker || pages.cached === 0
      ? "off"
      : pages.cached === pages.total
        ? "ok"
        : "warn";
  const tripLevel: Level =
    age.freshness === "never"
      ? "off"
      : age.freshness === "stale"
        ? "warn"
        : "ok";

  return (
    <section
      aria-labelledby="offline-title"
      className="flex w-full flex-col gap-3"
    >
      <h3 id="offline-title" className="text-sm font-medium">
        {t("offline.title")}
      </h3>
      <ul className="flex flex-col gap-2.5 text-sm">
        <Row
          level={pagesLevel}
          label={t("offline.pages")}
          detail={
            pages && pages.worker
              ? t("offline.pagesCount", {
                  cached: pages.cached,
                  total: pages.total,
                })
              : t("offline.pagesNone")
          }
        />
        <Row
          level={tripLevel}
          label={t("offline.trip")}
          detail={
            age.freshness === "never"
              ? t("offline.tripNever")
              : t(
                  age.freshness === "stale"
                    ? "offline.syncedStale"
                    : "offline.synced",
                  { ago: formatSyncAge(age) },
                )
          }
        />
        <Row
          level={pagesLevel}
          label={t("offline.language")}
          detail={t("offline.languageDetail")}
        />
        {storage !== null && storage !== "unsupported" && (
          <Row
            level={storage === "kept" ? "ok" : "warn"}
            label={t("offline.storage")}
            detail={
              storage === "kept"
                ? t("offline.storageKept")
                : t("offline.storageAtRisk")
            }
          />
        )}
        <Row
          level="off"
          label={t("offline.needsSignal")}
          detail={t("offline.needsSignalDetail")}
        />
      </ul>
      <Button
        variant="outline"
        className="self-start"
        disabled={busy || !online || !tripId}
        onClick={() => void refresh()}
      >
        <RefreshCw className={busy ? "animate-spin" : undefined} />
        {busy ? t("offline.refreshing") : t("offline.refresh")}
      </Button>
      {!online && (
        <p className="text-xs text-muted-foreground">
          {t("offline.refreshNeedsSignal")}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("offline.howItWorks")}</p>
    </section>
  );
}

const ICONS = { ok: CircleCheck, warn: CircleAlert, off: CloudOff } as const;

function Row({
  level,
  label,
  detail,
}: {
  level: Level;
  label: string;
  detail: ReactNode;
}) {
  const Icon = ICONS[level];
  return (
    <li data-level={level} className="flex items-start gap-2">
      <Icon
        aria-hidden
        className={
          level === "ok"
            ? "mt-0.5 size-4 shrink-0 text-primary"
            : level === "warn"
              ? "mt-0.5 size-4 shrink-0 text-warning"
              : "mt-0.5 size-4 shrink-0 text-muted-foreground"
        }
      />
      <div className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-1.5 font-medium">
          {label}
          {level === "warn" && (
            <Badge variant="outline" className="text-warning">
              {t("offline.check")}
            </Badge>
          )}
        </span>
        <span className="text-muted-foreground">{detail}</span>
      </div>
    </li>
  );
}
