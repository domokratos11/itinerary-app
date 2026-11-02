"use client";

import { useState } from "react";
import { CalendarClock, Copy, Link2, Plus, RefreshCw, Ban } from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clampExpiry,
  latestExpiry,
  shareStatus,
  toSharedTrip,
  type Share,
  type ShareStatus,
} from "@/domain/share";
import { logActivity } from "@/lib/activity-log";
import { useActiveTrip } from "@/lib/auth-store";
import { formatTokyoDateTime } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { usePlanStore } from "@/lib/plan-store";
import { shareRepository } from "@/lib/share-repository-instance";
import { useTripStore } from "@/lib/trip-store";
import { useShares } from "@/lib/use-shares";
import { shareUrl } from "@/lib/viewer-store";

const HOUR_MS = 60 * 60 * 1000;
const PRESETS = ["1", "3", "7", "14", "30", "custom"] as const;
type Preset = (typeof PRESETS)[number];

const STATUS_VARIANT: Record<ShareStatus, "default" | "secondary" | "outline"> =
  { active: "default", expired: "secondary", revoked: "outline" };

// The current trip as a viewer may see it, without amounts.
function currentCopy() {
  return toSharedTrip(
    useTripStore.getState().data,
    usePlanStore.getState().items,
    new Date(),
  );
}

// "2026-12-15T18:00" typed as Japan time (no daylight saving there).
function fromTokyoInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toTokyoInput(date: Date): string {
  return new Date(date.getTime() + 9 * HOUR_MS).toISOString().slice(0, 16);
}

// Settings → Share. Read-only links for people who aren't on the trip: they
// see the plan, places and map, never an amount, and can change nothing.
// A link shows the trip as it was when created or last refreshed.
export function ShareSettings({ tripId }: { tripId: string }) {
  const shares = useShares(tripId);
  const tripName = useActiveTrip()?.name ?? null;
  const [editing, setEditing] = useState<{ share: Share | null } | null>(null);
  const [revoking, setRevoking] = useState<Share | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const now = new Date();

  async function create(label: string, expiresAt: Date) {
    setEditing(null);
    setBusy("new");
    try {
      const share = await shareRepository.create(
        { tripId, tripName, label, expiresAt: expiresAt.toISOString() },
        currentCopy(),
      );
      logActivity(tripId, {
        kind: "settings",
        targetId: null,
        summary: t("activity.sharedLink", { label: label || share.id }),
      });
      await copy(share);
    } catch {
      toast.error(t("common.refused"));
    } finally {
      setBusy(null);
    }
  }

  async function changeExpiry(share: Share, expiresAt: Date) {
    setEditing(null);
    try {
      await shareRepository.setExpiry(share, expiresAt.toISOString());
      toast.success(t("share.expiryChanged"));
    } catch {
      toast.error(t("common.refused"));
    }
  }

  async function refresh(share: Share) {
    setBusy(share.id);
    try {
      await shareRepository.publish(share, currentCopy());
      logActivity(tripId, {
        kind: "settings",
        targetId: null,
        summary: t("activity.refreshedLink", {
          label: share.label || share.id,
        }),
      });
      toast.success(t("share.refreshed"));
    } catch {
      toast.error(t("common.refused"));
    } finally {
      setBusy(null);
    }
  }

  async function revoke(share: Share) {
    setRevoking(null);
    try {
      await shareRepository.revoke(share);
      logActivity(tripId, {
        kind: "settings",
        targetId: null,
        summary: t("activity.revokedLink", { label: share.label || share.id }),
      });
      toast.success(t("share.revoked"));
    } catch {
      toast.error(t("common.refused"));
    }
  }

  async function copy(share: Share) {
    try {
      await navigator.clipboard.writeText(shareUrl(share.id));
      toast.success(t("share.copied"));
    } catch {
      toast(shareUrl(share.id));
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3 text-sm">
      <p className="text-muted-foreground">{t("share.intro")}</p>
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {shares.map((share) => {
          const status = shareStatus(share, now);
          const open = status === "active";
          return (
            <li
              key={share.id}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <span className="flex flex-wrap items-center gap-2">
                <Link2 className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {share.label || t("share.untitled")}
                </span>
                <Badge variant={STATUS_VARIANT[status]}>
                  {t(`share.status.${status}`)}
                </Badge>
              </span>
              <span className="text-xs text-muted-foreground">
                {status === "revoked"
                  ? t("share.revokedNote")
                  : t(open ? "share.expires" : "share.expired", {
                      date: formatTokyoDateTime(share.expiresAt),
                    })}
                <br />
                {t("share.published", {
                  date: formatTokyoDateTime(share.publishedAt),
                })}
              </span>
              {status !== "revoked" && (
                <span className="flex flex-wrap gap-1.5">
                  {open && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void copy(share)}
                    >
                      <Copy />
                      {t("share.copy")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === share.id}
                    onClick={() => void refresh(share)}
                  >
                    <RefreshCw />
                    {t("share.refresh")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing({ share })}
                  >
                    <CalendarClock />
                    {t("share.changeExpiry")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRevoking(share)}
                  >
                    <Ban />
                    {t("share.revoke")}
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {shares.length === 0 && (
        <p className="text-muted-foreground">{t("share.none")}</p>
      )}
      <Button
        variant="outline"
        className="self-start"
        disabled={busy === "new"}
        onClick={() => setEditing({ share: null })}
      >
        <Plus />
        {t("share.create")}
      </Button>

      {editing && (
        <ShareForm
          key={editing.share?.id ?? "new"}
          share={editing.share}
          onCancel={() => setEditing(null)}
          onSave={(label, expiresAt) =>
            editing.share
              ? void changeExpiry(editing.share, expiresAt)
              : void create(label, expiresAt)
          }
        />
      )}

      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("share.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("share.revokeBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => revoking && void revoke(revoking)}
            >
              {t("share.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ShareForm({
  share,
  onCancel,
  onSave,
}: {
  share: Share | null;
  onCancel: () => void;
  onSave: (label: string, expiresAt: Date) => void;
}) {
  const [label, setLabel] = useState(share?.label ?? "");
  const [preset, setPreset] = useState<Preset>("7");
  const [custom, setCustom] = useState(() =>
    toTokyoInput(new Date(Date.now() + 7 * 24 * HOUR_MS)),
  );
  const now = new Date();
  const chosen =
    preset === "custom"
      ? fromTokyoInput(custom)
      : new Date(now.getTime() + Number(preset) * 24 * HOUR_MS);
  const valid =
    chosen !== null &&
    chosen.getTime() > now.getTime() &&
    chosen.getTime() <= latestExpiry(now).getTime() + 60_000;

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onCancel()}
      title={share ? t("share.changeExpiry") : t("share.create")}
      description={t("share.formHint")}
      submitLabel={share ? t("common.save") : t("share.createAndCopy")}
      canSubmit={valid}
      onSubmit={() => chosen && onSave(label.trim(), clampExpiry(chosen, now))}
    >
      {!share && (
        <Field
          label={t("share.label")}
          htmlFor="share-label"
          hint={t("share.labelHint")}
        >
          <Input
            id="share-label"
            value={label}
            maxLength={100}
            placeholder={t("share.labelPlaceholder")}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
      )}
      <Field label={t("share.validFor")} htmlFor="share-expiry">
        <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
          <SelectTrigger id="share-expiry" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p} value={p}>
                {p === "custom"
                  ? t("share.customDate")
                  : t("share.days", { count: Number(p) })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {preset === "custom" && (
        <Field
          label={t("share.until")}
          htmlFor="share-until"
          hint={t("share.untilHint")}
        >
          <Input
            id="share-until"
            type="datetime-local"
            value={custom}
            min={toTokyoInput(now)}
            max={toTokyoInput(latestExpiry(now))}
            onChange={(e) => setCustom(e.target.value)}
          />
        </Field>
      )}
      {chosen && valid && (
        <p className="text-xs text-muted-foreground">
          {t("share.closesAt", {
            date: formatTokyoDateTime(chosen.toISOString()),
          })}
        </p>
      )}
    </EditPanel>
  );
}
