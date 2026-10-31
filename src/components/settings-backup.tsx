"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import { EditPanel } from "@/components/edit-panel";
import { Button } from "@/components/ui/button";
import {
  BackupSchema,
  backupSummary,
  makeBackup,
  type Backup,
} from "@/domain/backup";
import { TRIP_COLLECTIONS } from "@/domain/trip";
import { t } from "@/lib/i18n";
import { importBackup } from "@/lib/backup-actions";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";
import { useProposals } from "@/lib/use-proposals";
import { useQueue } from "@/lib/use-queue";
import { useTripId } from "@/lib/use-trip-id";

// Downloads the whole trip as one JSON file.
export function ExportTrip({
  variant = "outline",
}: {
  variant?: "outline" | "default";
}) {
  const tripId = useTripId();
  const data = useTripStore((s) => s.data);
  const items = usePlanStore((s) => s.items);
  const queue = useQueue(tripId).items;
  const proposals = useProposals(tripId);

  function download() {
    const backup = makeBackup(data, items, queue, new Date(), proposals);
    const blob = new Blob([JSON.stringify(backup, null, 2) + "\n"], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `trip-backup-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <Button variant={variant} size="sm" onClick={download}>
      <Download />
      {t("backup.exportTrip")}
    </Button>
  );
}

// Settings → Backup. Import only goes into a trip with nothing saved yet,
// so a backup never overwrites someone's work.
export function BackupSettings({ tripId }: { tripId: string }) {
  const data = useTripStore((s) => s.data);
  const items = usePlanStore((s) => s.items);
  const queue = useQueue(tripId).items;
  const empty =
    TRIP_COLLECTIONS.every((name) => data[name].length === 0) &&
    items.length === 0 &&
    queue.length === 0;
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);

  async function read(file: File) {
    try {
      const result = BackupSchema.safeParse(JSON.parse(await file.text()));
      if (!result.success) throw new Error("not a backup");
      setPending(result.data);
    } catch {
      toast.error(t("backup.notABackup"));
    }
  }

  function restore(backup: Backup) {
    setPending(null);
    importBackup(tripId, backup)
      .then(() => toast.success(t("backup.restored")))
      .catch(() => toast.error(t("backup.refused")));
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">{t("backup.exportTitle")}</h3>
        <p className="text-muted-foreground">{t("backup.exportBody")}</p>
        <div>
          <ExportTrip />
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">{t("backup.importTitle")}</h3>
        <p className="text-muted-foreground">
          {empty ? t("backup.importEmpty") : t("backup.importFull")}
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void read(file);
            e.target.value = "";
          }}
        />
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={!empty}
            onClick={() => fileInput.current?.click()}
          >
            <Upload />
            {t("backup.choose")}
          </Button>
        </div>
      </section>
      {pending && (
        <EditPanel
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={t("backup.restoreTitle")}
          description={t("backup.exportedOn", {
            date: pending.exportedAt.slice(0, 10),
          })}
          submitLabel={t("common.restore")}
          onSubmit={() => restore(pending)}
        >
          <p className="text-sm">{backupSummary(pending, t)}.</p>
        </EditPanel>
      )}
    </div>
  );
}
