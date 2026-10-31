"use client";

import { useState } from "react";
import { toast } from "sonner";

import { EditPanel } from "@/components/edit-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { proposalRows } from "@/domain/proposals";
import type { PlaceRecord, Proposal } from "@/domain/schemas";
import { t } from "@/lib/i18n";
import {
  applyProposal,
  setProposalStatus,
  undoProposal,
} from "@/lib/proposal-actions";

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
  const rows = proposalRows(place, proposal, t);
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
      toast.error(t("common.refused")),
    );
    toast(t("proposal.updated", { name: place.name }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          undoProposal(tripId, proposal, place).catch(() =>
            toast.error(t("common.refused")),
          ),
      },
    });
  }

  function dismiss() {
    onClose();
    setProposalStatus(tripId, proposal, "dismissed").catch(() =>
      toast.error(t("common.refused")),
    );
    toast(t("proposal.dismissed", { name: place.name }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          setProposalStatus(tripId, proposal, "ready").catch(() =>
            toast.error(t("common.refused")),
          ),
      },
    });
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={place.name}
      description={t("proposal.description")}
      submitLabel={
        chosen === rows.length
          ? t("proposal.acceptAll")
          : t("proposal.acceptCount", { count: chosen })
      }
      canSubmit={chosen > 0}
      onSubmit={accept}
    >
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("proposal.nothingNew")}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.field} className="flex gap-3 rounded-lg border p-3">
            <Checkbox
              id={`proposal-${row.field}`}
              checked={accepted.has(row.field)}
              onCheckedChange={(on) => toggle(row.field, on === true)}
              aria-label={t("proposal.acceptField", { field: row.label })}
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
                  <Badge variant="destructive">{t("proposal.change")}</Badge>
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
        {t("proposal.dismiss")}
      </Button>
    </EditPanel>
  );
}
