"use client";

import { t } from "@/lib/i18n";
import { formatSyncAge, useSyncAge } from "@/lib/last-sync";
import { useSyncStore } from "@/lib/sync-store";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

// Shown while the phone has no connection. Edits are still saved on the
// phone and sent when the connection returns; the count says how many wait.
// It also says how old the phone's copy of the trip is, and warns once it is
// older than STALE_AFTER_DAYS.
export function OfflineBanner() {
  const online = useOnline();
  const pending = useSyncStore((s) => s.pending);
  const age = useSyncAge();
  if (online) return null;
  const stale = age.freshness === "stale";
  return (
    <div
      role="status"
      data-freshness={age.freshness}
      className={cn(
        "px-4 py-2 text-center text-sm",
        stale
          ? "bg-warning/15 font-medium text-warning"
          : "bg-muted text-muted-foreground",
      )}
    >
      {t("misc.offlineBanner")}
      {age.freshness !== "never" &&
        ` ${t(stale ? "offline.syncedStale" : "offline.synced", { ago: formatSyncAge(age) })}`}
      {pending > 0 && ` ${t("sync.waiting", { count: pending })}`}
    </div>
  );
}
