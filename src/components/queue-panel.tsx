"use client";

import { useState, type FormEvent } from "react";
import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMapsLink, type QueuedPlace } from "@/domain/queue";
import { queueAdd } from "@/lib/queue-actions";
import { useQueue } from "@/lib/use-queue";
import { useTripId } from "@/lib/use-trip-id";

// Paste a Google Maps link to queue a place for the next enrichment run
// (research, tips, hours and cost). The queue is shared by the trip.
export function QueuePanel() {
  const tripId = useTripId();
  const { items, error } = useQueue(tripId);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

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
      });
    } catch {
      toast.error("That link was refused. Check the trip link.");
      return;
    }
    toast.success("Queued for the next update");
    setUrl("");
    setNote("");
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

  if (!tripId) {
    return (
      <p className="text-sm text-muted-foreground">
        Open your shared link with ?trip= to queue places.
      </p>
    );
  }

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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {items.length} queued
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={exportQueue}
                disabled={!items.length}
              >
                <Download />
                Export queue
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <QueueRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QueueRow({ item }: { item: QueuedPlace }) {
  return (
    <li className="flex flex-col gap-1 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">
          {item.name ?? "Short link, name added in the next update"}
        </span>
        <Badge variant="outline">{item.createdAt.slice(0, 10)}</Badge>
      </div>
      {item.note && <span className="text-muted-foreground">{item.note}</span>}
      <a
        className="inline-flex items-center gap-1 text-xs underline"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink className="size-3" />
        Open link
      </a>
    </li>
  );
}
