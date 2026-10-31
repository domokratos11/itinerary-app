"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarPlus,
  Download,
  ExternalLink,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  parseMapsLink,
  suggestCity,
  type QueuedPlace,
  type QueueStatus,
} from "@/domain/queue";
import { CATEGORY_LABEL } from "@/lib/category-label";
import { CATEGORIES, type Category } from "@/domain/schemas";
import { formatDayLabel } from "@/lib/format-day";
import { assignQueued, queueAdd, queueUpdate } from "@/lib/queue-actions";
import { useCitiesById, useTrip, useTripDays } from "@/lib/trip-store";
import { useQueue } from "@/lib/use-queue";
import { useTripId } from "@/lib/use-trip-id";

const REFUSED = "That change was refused. Check the trip link.";
const NO_DAY = "none";

type Dialog =
  | { kind: "edit"; item: QueuedPlace }
  | { kind: "assign"; item: QueuedPlace }
  | null;

// Paste a Google Maps link to queue a place. From the queue, a link is
// assigned to a city and day (it becomes a draft place, researched later)
// or dismissed. The queue is shared by the trip.
export function QueuePanel() {
  const tripId = useTripId();
  const { items, error } = useQueue(tripId);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueStatus>("queued");
  const [dialog, setDialog] = useState<Dialog>(null);

  const counts = useMemo(() => {
    const c: Record<QueueStatus, number> = {
      queued: 0,
      promoted: 0,
      dismissed: 0,
    };
    for (const item of items) c[item.status] += 1;
    return c;
  }, [items]);
  const visible = items.filter((i) => i.status === filter);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tripId) return;
    const parsed = parseMapsLink(url);
    if (!parsed) {
      setProblem(
        "Paste a Google Maps link, such as one from maps.app.goo.gl or google.com/maps.",
      );
      return;
    }
    setProblem(null);
    try {
      await queueAdd(tripId, {
        url: url.trim(),
        name: parsed.name,
        lat: parsed.lat,
        lng: parsed.lng,
        note: note.trim() || null,
        category: category || null,
      });
    } catch {
      toast.error("That link was refused. Check the trip link.");
      return;
    }
    toast.success("Queued for the next update");
    setUrl("");
    setNote("");
    setCategory("");
  }

  function exportQueue() {
    const blob = new Blob([JSON.stringify(items, null, 2) + "\n"], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `place-queue-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function setStatus(item: QueuedPlace, status: QueueStatus) {
    if (!tripId) return;
    const id = tripId;
    queueUpdate(id, item, { status }).catch(() => toast.error(REFUSED));
    if (status === "dismissed")
      toast("Dismissed", {
        action: {
          label: "Undo",
          onClick: () =>
            queueUpdate(id, item, { status: item.status }).catch(() =>
              toast.error(REFUSED),
            ),
        },
      });
  }

  if (!tripId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Queue a place</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="queue-url">Google Maps link</Label>
            <Input
              id="queue-url"
              type="url"
              inputMode="url"
              placeholder="https://maps.app.goo.gl/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="queue-note">Note (optional)</Label>
            <Input
              id="queue-note"
              placeholder="Why we want it"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="queue-category">Category (optional)</Label>
            <CategorySelect
              id="queue-category"
              value={category}
              onChange={setCategory}
            />
          </div>
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          <Button type="submit" disabled={!url.trim()}>
            Add to queue
          </Button>
        </form>

        {error ? (
          <p className="text-sm text-destructive">
            Can&apos;t reach the queue: {error}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={filter}
                onValueChange={(v) => v && setFilter(v as QueueStatus)}
                aria-label="Show"
              >
                <ToggleGroupItem value="queued">
                  Queued {counts.queued}
                </ToggleGroupItem>
                <ToggleGroupItem value="promoted">
                  Assigned {counts.promoted}
                </ToggleGroupItem>
                <ToggleGroupItem value="dismissed">
                  Dismissed {counts.dismissed}
                </ToggleGroupItem>
              </ToggleGroup>
              <Button
                variant="outline"
                size="sm"
                onClick={exportQueue}
                disabled={!items.length}
              >
                <Download />
                Export
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {visible.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  onEdit={() => setDialog({ kind: "edit", item })}
                  onAssign={() => setDialog({ kind: "assign", item })}
                  onDismiss={() => setStatus(item, "dismissed")}
                  onRestore={() => setStatus(item, "queued")}
                />
              ))}
            </ul>
            {visible.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {filter === "queued"
                  ? "Nothing waiting. Paste a link above."
                  : "None yet."}
              </p>
            )}
          </div>
        )}
      </CardContent>

      {dialog?.kind === "edit" && (
        <EditQueued
          key={dialog.item.id}
          item={dialog.item}
          onClose={() => setDialog(null)}
          onSave={(changes) => {
            queueUpdate(tripId, dialog.item, changes).catch(() =>
              toast.error(REFUSED),
            );
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "assign" && (
        <AssignQueued
          key={dialog.item.id}
          item={dialog.item}
          onClose={() => setDialog(null)}
          onAssign={(cityId, date) => {
            const item = dialog.item;
            setDialog(null);
            assignQueued(tripId, item, cityId, date)
              .then(({ place }) =>
                toast.success(
                  date
                    ? `Added ${place.name} to ${formatDayLabel(date)}`
                    : `Added ${place.name} to the city list`,
                ),
              )
              .catch(() => toast.error(REFUSED));
          }}
        />
      )}
    </Card>
  );
}

function QueueRow({
  item,
  onEdit,
  onAssign,
  onDismiss,
  onRestore,
}: {
  item: QueuedPlace;
  onEdit: () => void;
  onAssign: () => void;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const city = useCitiesById().get(item.cityId ?? "");
  const name = item.name ?? "Short link, name added in the next update";
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 font-medium break-words">{name}</span>
        <Badge variant="outline" className="shrink-0">
          {item.createdAt.slice(0, 10)}
        </Badge>
      </div>
      {item.note && <span className="text-muted-foreground">{item.note}</span>}
      <div className="flex flex-wrap items-center gap-2">
        {city && <Badge variant="secondary">{city.name}</Badge>}
        {item.category && (
          <Badge variant="outline">{CATEGORY_LABEL[item.category]}</Badge>
        )}
        <a
          className="inline-flex items-center gap-1 text-xs underline"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="size-3" />
          Open link
        </a>
        <span className="ml-auto flex items-center gap-1">
          {item.status === "queued" && (
            <>
              <Button size="sm" onClick={onAssign}>
                <CalendarPlus />
                Assign
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${name}`}
                onClick={onEdit}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Dismiss ${name}`}
                onClick={onDismiss}
              >
                <X />
              </Button>
            </>
          )}
          {item.status === "dismissed" && (
            <Button variant="outline" size="sm" onClick={onRestore}>
              <RotateCcw />
              Restore
            </Button>
          )}
        </span>
      </div>
    </li>
  );
}

const NO_CATEGORY = "none";

function CategorySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Category | "";
  onChange: (category: Category | "") => void;
}) {
  return (
    <Select
      value={value || NO_CATEGORY}
      onValueChange={(v) => onChange(v === NO_CATEGORY ? "" : (v as Category))}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue>{value ? CATEGORY_LABEL[value] : "Not set"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_CATEGORY}>Not set</SelectItem>
        {CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CitySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (cityId: string) => void;
}) {
  const { cities } = useTrip();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose a city" />
      </SelectTrigger>
      <SelectContent>
        {cities.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// The city stored on the item, else the one nearest to the link.
function useSuggestedCity(item: QueuedPlace): string {
  const trip = useTrip();
  return item.cityId ?? suggestCity(item, trip.places, trip.stays) ?? "";
}

function EditQueued({
  item,
  onClose,
  onSave,
}: {
  item: QueuedPlace;
  onClose: () => void;
  onSave: (
    changes: Pick<QueuedPlace, "name" | "note" | "cityId" | "category">,
  ) => void;
}) {
  const [name, setName] = useState(item.name ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [cityId, setCityId] = useState(useSuggestedCity(item));
  const [category, setCategory] = useState<Category | "">(item.category ?? "");
  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title="Edit queued place"
      onSubmit={() =>
        onSave({
          name: name.trim() || null,
          note: note.trim() || null,
          cityId: cityId || null,
          category: category || null,
        })
      }
    >
      <Field label="Name" htmlFor="queued-name">
        <Input
          id="queued-name"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Note" htmlFor="queued-note">
        <Input
          id="queued-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <Field label="City" htmlFor="queued-city">
        <CitySelect id="queued-city" value={cityId} onChange={setCityId} />
      </Field>
      <Field
        label="Category"
        htmlFor="queued-category"
        hint="Kept when you assign it to a day."
      >
        <CategorySelect
          id="queued-category"
          value={category}
          onChange={setCategory}
        />
      </Field>
    </EditPanel>
  );
}

function AssignQueued({
  item,
  onClose,
  onAssign,
}: {
  item: QueuedPlace;
  onClose: () => void;
  onAssign: (cityId: string, date: string | null) => void;
}) {
  const days = useTripDays();
  const [cityId, setCityId] = useState(useSuggestedCity(item));
  const cityDays = days.filter((d) => d.cityIds.includes(cityId));
  const [date, setDate] = useState(cityDays[0]?.date ?? NO_DAY);
  // Changing the city resets the day to that city's first day.
  function pickCity(next: string) {
    setCityId(next);
    setDate(days.find((d) => d.cityIds.includes(next))?.date ?? NO_DAY);
  }

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title="Assign to a day"
      description={
        item.name ??
        "This short link's name is added when the place is researched."
      }
      submitLabel={date === NO_DAY ? "Add to city" : "Add to day"}
      canSubmit={cityId !== ""}
      onSubmit={() => onAssign(cityId, date === NO_DAY ? null : date)}
    >
      <Field
        label="City"
        htmlFor="assign-city"
        hint={
          item.cityId === null && cityId !== ""
            ? "Suggested from the link's location."
            : undefined
        }
      >
        <CitySelect id="assign-city" value={cityId} onChange={pickCity} />
      </Field>
      <Field label="Day" htmlFor="assign-day">
        <Select value={date} onValueChange={setDate} disabled={!cityId}>
          <SelectTrigger id="assign-day" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cityDays.map((d) => (
              <SelectItem key={d.date} value={d.date}>
                {formatDayLabel(d.date)}
              </SelectItem>
            ))}
            <SelectItem value={NO_DAY}>No day yet, city list only</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <p className="text-xs text-muted-foreground">
        It becomes a place marked &ldquo;Not researched yet&rdquo; until the
        next update fills in hours, cost and tips.
      </p>
    </EditPanel>
  );
}
