"use client";

import { useState } from "react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { Input } from "@/components/ui/input";
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
        toast.error("The trip couldn't be created.");
      });
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title="New trip"
      description={
        online
          ? "It starts empty, with you as its only member."
          : "Creating a trip needs a connection."
      }
      submitLabel="Create trip"
      canSubmit={online && !saving && trimmed.length > 0}
      onSubmit={create}
    >
      <Field label="Name" htmlFor="new-trip-name">
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
