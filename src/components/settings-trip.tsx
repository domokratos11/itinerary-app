"use client";

import { useState, type FormEvent } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/edit-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { memberEmail } from "@/domain/trip-edit";
import { logActivity } from "@/lib/activity-log";
import { useActiveTrip, useAuthStore } from "@/lib/auth-store";
import { tripRepository } from "@/lib/trip-repository-instance";

const REFUSED = "That change was refused. Check your connection.";

// The trip itself: its name and who is on it. Anyone on the trip can change
// these; the rules keep them from removing themselves.
export function TripSettings({ tripId }: { tripId: string }) {
  const trip = useActiveTrip();
  const me = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);
  const [name, setName] = useState(trip?.name ?? "");
  const [email, setEmail] = useState("");
  const members = trip?.members ?? [];
  const trimmed = name.trim();
  const added = memberEmail(email);

  function saveName(event: FormEvent) {
    event.preventDefault();
    tripRepository
      .updateTrip(tripId, { name: trimmed })
      .then(() =>
        logActivity(tripId, {
          kind: "settings",
          targetId: null,
          summary: `renamed the trip to ${trimmed}`,
        }),
      )
      .catch(() => toast.error(REFUSED));
  }

  function saveMembers(next: string[]) {
    tripRepository
      .updateTrip(tripId, { members: next })
      .then(() =>
        logActivity(tripId, {
          kind: "settings",
          targetId: null,
          summary: "changed who is on the trip",
        }),
      )
      .catch(() => toast.error(REFUSED));
  }

  function addMember(event: FormEvent) {
    event.preventDefault();
    if (!added) return;
    setEmail("");
    if (!members.includes(added)) saveMembers([...members, added]);
  }

  return (
    <div className="flex flex-col gap-6 text-sm">
      <form onSubmit={saveName} className="flex flex-col gap-3">
        <Field label="Trip name" htmlFor="trip-name">
          <Input
            id="trip-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Button
          type="submit"
          variant="outline"
          className="self-start"
          disabled={trimmed.length === 0 || trimmed === trip?.name}
        >
          Save name
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        <h3 className="font-medium">Members</h3>
        <p className="text-muted-foreground">
          Each person signs in with this Google account to see and edit the
          trip.
        </p>
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <span className="min-w-0 flex-1 truncate">{member}</span>
              {member !== me && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${member}`}
                  onClick={() =>
                    saveMembers(members.filter((m) => m !== member))
                  }
                >
                  <UserMinus />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={addMember} className="flex flex-col gap-3">
          <Field label="Add a member" htmlFor="trip-member">
            <Input
              id="trip-member"
              type="email"
              value={email}
              maxLength={200}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            variant="outline"
            className="self-start"
            disabled={!added}
          >
            <UserPlus />
            Add member
          </Button>
        </form>
      </section>
    </div>
  );
}
