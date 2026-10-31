"use client";

import { useState } from "react";
import { toast } from "sonner";

import { EditPanel } from "@/components/edit-panel";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { APP_VERSION, resetApp } from "@/lib/app-reset";
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
        {t("common.version", { version: APP_VERSION })}
      </p>
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
