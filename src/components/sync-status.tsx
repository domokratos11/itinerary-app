"use client";

import { CloudCheck, CloudOff, CloudUpload } from "lucide-react";
import { toast } from "sonner";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { syncStatus, useSyncStore } from "@/lib/sync-store";
import { useOnline } from "@/lib/use-online";

// The header's answer to "has my edit reached the others?". Tooltips don't
// open on a tap, so tapping says it in a toast too.
export function SyncStatus() {
  const pending = useSyncStore((s) => s.pending);
  const startup = useSyncStore((s) => s.startup);
  const online = useOnline();
  const status = syncStatus({ pending, startup }, online);

  const label =
    status === "saved"
      ? t("sync.saved")
      : status === "saving"
        ? pending > 0
          ? t("sync.saving", { count: pending })
          : t("sync.savingEarlier")
        : pending > 0
          ? t("sync.waiting", { count: pending })
          : t("sync.waitingEarlier");
  const Icon =
    status === "saved"
      ? CloudCheck
      : status === "saving"
        ? CloudUpload
        : CloudOff;

  return (
    <Tip label={label}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        data-status={status}
        onClick={() => toast(label, { id: "sync-status" })}
        className={
          status === "saved"
            ? "text-muted-foreground"
            : status === "saving"
              ? "text-primary"
              : "text-warning"
        }
      >
        <Icon className={status === "saving" ? "animate-pulse" : undefined} />
      </Button>
    </Tip>
  );
}
