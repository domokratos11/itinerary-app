"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EditPanel } from "@/components/edit-panel";
import { Button } from "@/components/ui/button";
import { WhatsNewButton } from "@/components/whats-new";
import { t } from "@/lib/i18n";
import { APP_VERSION, resetApp } from "@/lib/app-reset";
import {
  requestPersistentStorage,
  storageStatus,
  type StorageStatus,
} from "@/lib/storage-persist";
import { checkForUpdate } from "@/lib/version-check";

// Which version this is, and the way to start fresh by hand. New versions are
// picked up by themselves; this is for when something looks out of date.
export function AboutSettings() {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function check() {
    setBusy(true);
    checkForUpdate(true).then((result) => {
      if (result === "updating") return;
      setBusy(false);
      if (result === "current") toast.success(t("about.latest"));
      else toast.error(t("about.couldntCheck"));
    });
  }

  return (
    <section className="flex w-full flex-col gap-2">
      <h3 className="text-sm font-medium">{t("about.title")}</h3>
      <p className="text-sm text-muted-foreground">
        <WhatsNewButton>
          {t("common.version", { version: APP_VERSION })}
        </WhatsNewButton>
      </p>
      <OfflineCopyStatus />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={check}>
          {t("about.check")}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          {t("about.clear")}
        </Button>
      </div>
      {confirming && (
        <EditPanel
          open
          onOpenChange={(open) => !open && setConfirming(false)}
          title={t("about.confirmTitle")}
          description={t("about.confirmBody")}
          submitLabel={t("about.confirmSubmit")}
          onSubmit={() => {
            setConfirming(false);
            setBusy(true);
            void resetApp(APP_VERSION);
          }}
        >
          {null}
        </EditPanel>
      )}
    </section>
  );
}

// Whether the browser promised to keep the offline copy of the trip.
function OfflineCopyStatus() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  useEffect(() => {
    let live = true;
    void storageStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);
  if (status === null || status === "unsupported") return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <p>
        {status === "kept" ? t("about.storageKept") : t("about.storageAtRisk")}
      </p>
      {status === "may-be-cleared" && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() =>
            void requestPersistentStorage().then((s) => {
              setStatus(s);
              if (s !== "kept") toast(t("about.storageRefused"));
            })
          }
        >
          {t("about.storageAsk")}
        </Button>
      )}
    </div>
  );
}
