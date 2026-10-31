"use client";

import { useMemo, useState } from "react";
import { Archive, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { AddPlace } from "@/components/add-place";
import { PlaceEditor } from "@/components/place-editor";
import { ProposalReview } from "@/components/proposal-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  hasPin,
  matchesPlaceFilter,
  missingFields,
  PLACE_FILTER_LABEL,
  PLACE_FILTERS,
  RESEARCH_FIELD_LABEL,
  type PlaceFilter,
} from "@/domain/place-edit";
import type { PlaceRecord, Proposal } from "@/domain/schemas";
import { requestResearch } from "@/lib/proposal-actions";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";
import { useTrip } from "@/lib/trip-store";
import { useProposals } from "@/lib/use-proposals";

const REFUSED = "That change was refused. Check the trip link.";

// Settings → Places: every place by city, with filters for what's missing.
export function PlacesSettings({ tripId }: { tripId: string }) {
  const trip = useTrip();
  const [cityId, setCityId] = useState<string>(trip.cities[0]?.id ?? "");
  const [filter, setFilter] = useState<PlaceFilter>("all");
  const [editing, setEditing] = useState<PlaceRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState<string | null>(null);
  const proposals = useProposals(tripId);
  const ready = useMemo(
    () =>
      new Map(
        proposals
          .filter((p) => p.status === "ready")
          .map((p): [string, Proposal] => [p.placeId, p]),
      ),
    [proposals],
  );
  const requested = useMemo(
    () =>
      new Set(
        proposals.filter((p) => p.status === "requested").map((p) => p.placeId),
      ),
    [proposals],
  );
  const reviewable = useMemo(() => new Set(ready.keys()), [ready]);

  const visible = useMemo(
    () =>
      trip.places.filter(
        (p) => p.cityId === cityId && matchesPlaceFilter(p, filter, reviewable),
      ),
    [trip.places, cityId, filter, reviewable],
  );

  // Only what's on screen counts, so a filter change can't research places
  // nobody can see.
  const chosen = visible.filter((p) => selected.has(p.id));
  const allChosen = visible.length > 0 && chosen.length === visible.length;
  const reviewProposal = reviewing ? ready.get(reviewing) : undefined;
  const reviewPlace = trip.places.find((p) => p.id === reviewing);

  function toggle(placeId: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(placeId);
    else next.delete(placeId);
    setSelected(next);
  }

  function research() {
    requestResearch(tripId, chosen, proposals)
      .then((count) =>
        toast(
          count === 0
            ? "Those places already have research requested."
            : `Research requested for ${count} ${count === 1 ? "place" : "places"}. It arrives after the next research run.`,
        ),
      )
      .catch(() => toast.error(REFUSED));
    setSelected(new Set());
  }

  function archive(place: PlaceRecord) {
    archiveRecord(tripId, "places", place, `archived ${place.name}`).catch(() =>
      toast.error(REFUSED),
    );
    toast(`Archived ${place.name}`, {
      action: {
        label: "Undo",
        onClick: () =>
          saveRecord(tripId, "places", place, `restored ${place.name}`).catch(
            () => toast.error(REFUSED),
          ),
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {ready.size > 0 && (
        <Button
          variant="outline"
          className="h-auto justify-start py-2 whitespace-normal"
          onClick={() => setFilter("review")}
        >
          {ready.size} {ready.size === 1 ? "place has" : "places have"} research
          to review
        </Button>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={cityId} onValueChange={setCityId}>
          <SelectTrigger aria-label="City" className="w-full">
            <SelectValue placeholder="Choose a city" />
          </SelectTrigger>
          <SelectContent>
            {trip.cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as PlaceFilter)}
        >
          <SelectTrigger aria-label="Filter" className="w-full">
            <SelectValue>{PLACE_FILTER_LABEL[filter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PLACE_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {PLACE_FILTER_LABEL[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={allChosen}
            onCheckedChange={(on) =>
              setSelected(
                on === true ? new Set(visible.map((p) => p.id)) : new Set(),
              )
            }
            aria-label="Select all shown"
          />
          {visible.length} {visible.length === 1 ? "place" : "places"}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={chosen.length === 0}
            onClick={research}
          >
            <Search />
            Research{chosen.length > 0 ? ` ${chosen.length}` : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus />
            Add place
          </Button>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((place) => (
          <PlaceRow
            key={place.id}
            place={place}
            checked={selected.has(place.id)}
            requested={requested.has(place.id)}
            canReview={ready.has(place.id)}
            onCheck={(on) => toggle(place.id, on)}
            onReview={() => setReviewing(place.id)}
            onEdit={() => setEditing(place)}
            onArchive={() => archive(place)}
          />
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No places match this filter.
        </p>
      )}

      {editing && (
        <PlaceEditor
          key={editing.id}
          tripId={tripId}
          place={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {reviewProposal && reviewPlace && (
        <ProposalReview
          key={reviewProposal.id}
          tripId={tripId}
          proposal={reviewProposal}
          place={reviewPlace}
          onClose={() => setReviewing(null)}
        />
      )}
      {adding && (
        <AddPlace
          tripId={tripId}
          defaultCityId={cityId}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function PlaceRow({
  place,
  checked,
  requested,
  canReview,
  onCheck,
  onReview,
  onEdit,
  onArchive,
}: {
  place: PlaceRecord;
  checked: boolean;
  requested: boolean;
  canReview: boolean;
  onCheck: (on: boolean) => void;
  onReview: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const missing = missingFields(place);
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(on) => onCheck(on === true)}
        aria-label={`Select ${place.name}`}
        className="mt-0.5"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-medium">{place.name}</span>
        <span className="flex flex-wrap gap-1.5">
          {canReview && (
            <Button size="xs" onClick={onReview}>
              Review research
            </Button>
          )}
          {requested && <Badge variant="secondary">Research requested</Badge>}
          {!hasPin(place) && <Badge variant="outline">No map pin</Badge>}
          {missing.map((field) => (
            <Badge
              key={field}
              variant="outline"
              className="border-dashed text-muted-foreground"
            >
              No {RESEARCH_FIELD_LABEL[field]}
            </Badge>
          ))}
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${place.name}`}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Archive ${place.name}`}
        onClick={onArchive}
      >
        <Archive />
      </Button>
    </li>
  );
}
