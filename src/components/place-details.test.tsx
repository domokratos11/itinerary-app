import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlaceDetails } from "@/components/place-details";
import { placeRecordDefaults, type PlaceRecord } from "@/domain/schemas";

vi.mock("@/components/add-to-day", () => ({ AddToDay: () => null }));
vi.mock("@/components/place-live", () => ({ PlaceLive: () => null }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("@/lib/use-trip-id", () => ({ useTripId: () => "trip" }));
vi.mock("@/lib/use-proposals", () => ({ useProposals: () => [] }));
vi.mock("@/lib/proposal-actions", () => ({ requestResearch: vi.fn() }));

const place = {
  ...placeRecordDefaults(),
  id: "ueno-zoo",
  cityId: "tokyo-ueno",
  name: "Ueno Zoo",
  lat: null,
  lng: null,
  category: "sight",
  priority: "must",
  purpose: null,
  description: null,
  tips: [],
  costEstimateJPY: null,
  durationMin: null,
  openingHours: null,
  closedDates: [],
  seasonFrom: null,
  seasonTo: null,
  notes: null,
  website: null,
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Ueno+Zoo",
  verifiedAt: null,
  status: "researched",
  source: "catalog",
  archived: false,
  updatedAt: null,
} as unknown as PlaceRecord;

function details(props: { inPlan?: boolean; onArchive?: () => void }) {
  render(
    <PlaceDetails
      place={place}
      nearby={[]}
      onOpenChange={vi.fn()}
      {...props}
    />,
  );
}

describe("PlaceDetails archive", () => {
  it("archives a place no plan item uses", () => {
    const onArchive = vi.fn();
    details({ onArchive });
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchive).toHaveBeenCalledWith(place);
  });

  it("refuses while a plan item uses the place", () => {
    details({ inPlan: true, onArchive: vi.fn() });
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(screen.getByText(/It's in the plan/)).toBeInTheDocument();
  });

  it("offers only Edit where archiving doesn't apply", () => {
    details({});
    expect(screen.getByRole("button", { name: "Edit place" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
  });
});
