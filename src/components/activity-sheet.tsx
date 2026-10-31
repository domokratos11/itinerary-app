"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { undoFor, type Activity } from "@/domain/activity";
import { t } from "@/lib/i18n";
import {
  DEFAULT_DEVICE_NAME,
  getDeviceName,
  setDeviceName,
} from "@/lib/device-name";
import { formatDayLabel } from "@/lib/format-day";
import { restoreItem, undoActivity } from "@/lib/plan-actions";
import { usePlanStore } from "@/lib/plan-store";
import { todayInTokyo } from "@/lib/tokyo-date";
import { usePlacesById } from "@/lib/trip-store";
import { useActivity } from "@/lib/use-activity";
import { useTripId } from "@/lib/use-trip-id";

const timeInTokyo = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
});

// The device name lives in localStorage, read after hydration.
const noopSubscribe = () => () => {};

// Who changed what, newest first, grouped by day in Japan time. Plan
// changes can be undone while the stop hasn't changed since. Removed stops
// are listed apart so they can be restored even when the change is old.
export function ActivitySheet({ compact = false }: { compact?: boolean }) {
  const tripId = useTripId();
  const [open, setOpen] = useState(false);
  const { entries, error } = useActivity(tripId, open);
  const items = usePlanStore((s) => s.items);
  const placesById = usePlacesById();
  const itemsById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );
  const removed = useMemo(
    () =>
      items
        .filter((i) => i.status === "removed")
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [items],
  );

  const groups = useMemo(() => {
    const byDay = new Map<string, Activity[]>();
    for (const e of entries) {
      const key = todayInTokyo(new Date(e.at));
      byDay.set(key, [...(byDay.get(key) ?? []), e]);
    }
    return [...byDay.entries()];
  }, [entries]);

  function undo(entry: Activity) {
    if (!tripId) return;
    undoActivity(tripId, entry, itemsById.get(entry.targetId ?? ""))
      .then((done) => {
        if (done) toast.success(t("activity.undone"));
        else toast(t("activity.cantUndo"));
      })
      .catch(() => toast.error(t("common.refused")));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "icon-sm" : "sm"}
          aria-label={t("activity.title")}
        >
          <History />
          {!compact && t("activity.title")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>{t("activity.title")}</SheetTitle>
          <SheetDescription>{t("activity.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <DeviceName />
          <Tabs defaultValue="activity">
            <TabsList className="w-full">
              <TabsTrigger value="activity">
                {t("activity.changes")}
              </TabsTrigger>
              <TabsTrigger value="removed">
                {t("activity.removedStops", { count: removed.length })}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="activity" className="flex flex-col gap-4 pt-2">
              {error && (
                <p className="text-sm text-destructive">
                  {t("activity.cantLoad", { error })}
                </p>
              )}
              {tripId && !error && entries.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("activity.none")}
                </p>
              )}
              {groups.map(([date, list]) => (
                <section key={date} className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {date === todayInTokyo()
                      ? t("common.today")
                      : formatDayLabel(date)}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {list.map((entry) => {
                      const canUndo =
                        entry.kind !== "undone" &&
                        undoFor(
                          entry,
                          itemsById.get(entry.targetId ?? ""),
                          new Date(),
                        ) !== null;
                      return (
                        <li
                          key={entry.id}
                          className="flex items-start justify-between gap-2 rounded-md border p-3 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="font-medium">{entry.device}</span>{" "}
                            {entry.summary}
                            <span className="text-muted-foreground">
                              {" "}
                              · {timeInTokyo.format(new Date(entry.at))}
                            </span>
                          </span>
                          {canUndo && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => undo(entry)}
                            >
                              {t("common.undo")}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </TabsContent>
            <TabsContent value="removed" className="pt-2">
              {removed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("activity.noRemoved")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {removed.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">
                          {placesById.get(item.placeId)?.name ?? item.placeId}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDayLabel(item.date)}
                        </span>
                      </span>
                      {tripId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            restoreItem(tripId, {
                              ...item,
                              status: "planned",
                            }).catch(() => toast.error(t("common.refused")))
                          }
                        >
                          {t("common.restore")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// "Your changes are signed as: Rey's phone [Save]".
function DeviceName() {
  const stored = useSyncExternalStore(noopSubscribe, getDeviceName, () => "");
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? (stored === DEFAULT_DEVICE_NAME ? "" : stored);

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setDeviceName(value);
        setDraft(null);
        toast.success(t("activity.deviceSigned", { name: value.trim() }));
      }}
    >
      <Label htmlFor="device-name">{t("activity.deviceName")}</Label>
      <div className="flex gap-2">
        <Input
          id="device-name"
          value={value}
          maxLength={40}
          placeholder={t("activity.devicePlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={draft === null}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
