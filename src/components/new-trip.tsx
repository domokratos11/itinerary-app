"use client";

import { useState } from "react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/lib/auth-store";
import { openTrip } from "@/lib/trip-id";
import { tripRepository } from "@/lib/trip-repository-instance";
import { useOnline } from "@/lib/use-online";

// Names a new trip, with the signed-in user as its only member, and opens it.
export function NewTripPanel({ onClose }: { onClose: () => void }) {
  const email = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);
  const online = useOnline();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  function create() {
    if (!email) return;
    setSaving(true);
    tripRepository
      .createTrip(trimmed, email)
      .then(openTrip)
      .catch(() => {
        setSaving(false);
        toast.error(t("newTrip.failed"));
      });
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("gate.newTrip")}
      description={
        online
          ? t("newTrip.descriptionOnline")
          : t("newTrip.descriptionOffline")
      }
      submitLabel={t("newTrip.create")}
      canSubmit={online && !saving && trimmed.length > 0}
      onSubmit={create}
    >
      <Field label={t("common.name")} htmlFor="new-trip-name">
        <Input
          id="new-trip-name"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
    </EditPanel>
  );
}
