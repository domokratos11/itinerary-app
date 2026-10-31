"use client";

import { useState } from "react";
import { toast } from "sonner";

import { EditPanel } from "@/components/edit-panel";
import { Button } from "@/components/ui/button";
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
      if (result === "current") toast.success("You're on the latest version.");
      else toast.error("Couldn't check. Are you online?");
    });
  }

  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      <h2 className="text-base font-semibold">About</h2>
      <p className="text-sm text-muted-foreground">Version {APP_VERSION}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={check}>
          Check for updates
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          Clear data and sign in again
        </Button>
      </div>
      {confirming && (
        <EditPanel
          open
          onOpenChange={(open) => !open && setConfirming(false)}
          title="Clear this device's data?"
          description="This signs you out and removes the app's copy of the trip from this device. The trip itself stays safe in the cloud. Changes made offline that haven't synced yet may be lost."
          submitLabel="Clear and sign in again"
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
