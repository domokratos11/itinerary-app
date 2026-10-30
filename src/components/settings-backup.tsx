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
import { importBackup } from "@/lib/backup-actions";
import { usePlanStore } from "@/lib/plan-store";
import { useTripStore } from "@/lib/trip-store";
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

  function download() {
    const backup = makeBackup(data, items, queue, new Date());
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
      Export trip
    </Button>
  );
}

// Settings → Backup. Import only goes into a trip with nothing saved yet,
// so a backup never overwrites someone's work.
export function BackupSettings({ tripId }: { tripId: string }) {
  const live = useTripStore((s) => s.live);
  const items = usePlanStore((s) => s.items);
  const queue = useQueue(tripId).items;
  const empty =
    !Object.values(live).some(Boolean) &&
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
      toast.error("That file isn't a trip backup.");
    }
  }

  function restore(backup: Backup) {
    setPending(null);
    importBackup(tripId, backup)
      .then(() => toast.success("Backup restored"))
      .catch(() => toast.error("The backup was refused. Check the trip link."));
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Export</h3>
        <p className="text-muted-foreground">
          The whole trip in one file: cities, stays, reservations, places, the
          plan and the queue. Keep a copy in data/backups/ in the repo.
        </p>
        <div>
          <ExportTrip />
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Import</h3>
        <p className="text-muted-foreground">
          {empty
            ? "Restore a backup into this trip. Only works while the trip has nothing saved yet."
            : "This trip already has saved changes, so a backup can't be imported here. Create a new trip in Firebase and open its link to restore into it."}
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
            Choose a backup file
          </Button>
        </div>
      </section>
      {pending && (
        <EditPanel
          open
          onOpenChange={(open) => !open && setPending(null)}
          title="Restore this backup?"
          description={`Exported ${pending.exportedAt.slice(0, 10)}`}
          submitLabel="Restore"
          onSubmit={() => restore(pending)}
        >
          <p className="text-sm">{backupSummary(pending)}.</p>
        </EditPanel>
      )}
    </div>
  );
}
