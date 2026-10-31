"use client";

import { useState } from "react";
import { toast } from "sonner";

import { EditPanel } from "@/components/edit-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { proposalRows } from "@/domain/proposals";
import type { PlaceRecord, Proposal } from "@/domain/schemas";
import {
  applyProposal,
  setProposalStatus,
  undoProposal,
} from "@/lib/proposal-actions";

const REFUSED = "That change was refused. Check the trip link.";

// Old value against new value for each field, with its sources. Nothing
// reaches the place until it's accepted here.
export function ProposalReview({
  tripId,
  proposal,
  place,
  onClose,
}: {
  tripId: string;
  proposal: Proposal;
  place: PlaceRecord;
  onClose: () => void;
}) {
  const rows = proposalRows(place, proposal);
  const [accepted, setAccepted] = useState<Set<string>>(
    () => new Set(rows.map((row) => row.field)),
  );
  const chosen = rows.filter((row) => accepted.has(row.field)).length;

  function toggle(field: string, on: boolean) {
    const next = new Set(accepted);
    if (on) next.add(field);
    else next.delete(field);
    setAccepted(next);
  }

  function accept() {
    onClose();
    applyProposal(tripId, proposal, place, accepted).catch(() =>
      toast.error(REFUSED),
    );
    toast(`Updated ${place.name}`, {
      action: {
        label: "Undo",
        onClick: () =>
          undoProposal(tripId, proposal, place).catch(() =>
            toast.error(REFUSED),
          ),
      },
    });
  }

  function dismiss() {
    onClose();
    setProposalStatus(tripId, proposal, "dismissed").catch(() =>
      toast.error(REFUSED),
    );
    toast(`Dismissed research for ${place.name}`, {
      action: {
        label: "Undo",
        onClick: () =>
          setProposalStatus(tripId, proposal, "ready").catch(() =>
            toast.error(REFUSED),
          ),
      },
    });
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={place.name}
      description="Choose what to keep. Check the sources for anything marked as a change."
      submitLabel={chosen === rows.length ? "Accept all" : `Accept ${chosen}`}
      canSubmit={chosen > 0}
      onSubmit={accept}
    >
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing new: this research has no values to add to the place.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.field} className="flex gap-3 rounded-lg border p-3">
            <Checkbox
              id={`proposal-${row.field}`}
              checked={accepted.has(row.field)}
              onCheckedChange={(on) => toggle(row.field, on === true)}
              aria-label={`Accept ${row.label}`}
              className="mt-0.5"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor={`proposal-${row.field}`}
                  className="font-medium"
                >
                  {row.label}
                </label>
                {row.kind === "change" && (
                  <Badge variant="destructive">Change</Badge>
                )}
              </div>
              {row.kind === "change" && (
                <p className="text-muted-foreground line-through">
                  {row.before}
                </p>
              )}
              <p className="break-words">{row.after}</p>
              {row.sources.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-muted-foreground underline"
                >
                  {url}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {proposal.notes && (
        <p className="text-sm text-muted-foreground">{proposal.notes}</p>
      )}
      <Button
        type="button"
        variant="ghost"
        className="self-start"
        onClick={dismiss}
      >
        Dismiss this research
      </Button>
    </EditPanel>
  );
}
