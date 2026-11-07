"use client";

import { t } from "@/lib/i18n";
import { useSyncStore } from "@/lib/sync-store";
import { useOnline } from "@/lib/use-online";

// Shown while the phone has no connection. Edits are still saved on the
// phone and sent when the connection returns; the count says how many wait.
export function OfflineBanner() {
  const online = useOnline();
  const pending = useSyncStore((s) => s.pending);
  if (online) return null;
  return (
    <div
      role="status"
      className="bg-muted px-4 py-2 text-center text-sm text-muted-foreground"
    >
      {t("misc.offlineBanner")}
      {pending > 0 && ` ${t("sync.waiting", { count: pending })}`}
    </div>
  );
}
