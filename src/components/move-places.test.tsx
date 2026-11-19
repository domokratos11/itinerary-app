import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MovePlaces } from "@/components/move-places";
import type { PlaceRecord } from "@/domain/schemas";
import { testPlace } from "@/domain/test-place";
import { usePlanStore } from "@/lib/plan-store";
import { saveRecords } from "@/lib/trip-actions";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/trip-actions", () => ({
  saveRecords: vi.fn(() => Promise.resolve()),
}));
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
);
vi.mock("sonner", () => ({ toast }));

const free = testPlace({ id: "free", name: "Free Place" });
const planned = testPlace({ id: "planned", name: "Planned Place" });

function show(places: PlaceRecord[], onMoved = vi.fn()) {
  render(
    <MovePlaces
      tripId="trip-1"
      places={places}
      fromCityId="tokyo-ueno"
      onClose={vi.fn()}
      onMoved={onMoved}
    />,
  );
  return onMoved;
}

describe("MovePlaces", () => {
  beforeEach(() => {
    vi.mocked(saveRecords).mockClear();
    toast.mockClear();
    useTripStore.setState({
      data: { ...fixtureTrip, places: [free, planned] },
    });
    usePlanStore.setState({
      items: [
        {
          id: "i1",
          placeId: "planned",
          date: "2026-12-16",
          order: "a0",
          status: "planned",
          updatedAt: "2026-10-29T00:00:00.000Z",
        },
      ],
    });
  });

  it("moves only the places that aren't on a day, with Undo", () => {
    const onMoved = show([free, planned]);
    expect(
      screen.getByText(/1 place is already on a day and stays in Tokyo/),
    ).toHaveTextContent("Planned Place");
    fireEvent.click(screen.getByRole("button", { name: "Move 1 place" }));
    const [, collection, moved] = vi.mocked(saveRecords).mock.calls[0];
    expect(collection).toBe("places");
    expect((moved as PlaceRecord[]).map((p) => [p.id, p.cityId])).toEqual([
      ["free", "nagoya"],
    ]);
    expect(onMoved).toHaveBeenCalled();
    const [, options] = toast.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    const [, , restored] = vi.mocked(saveRecords).mock.calls[1];
    expect((restored as PlaceRecord[])[0].cityId).toBe("tokyo-ueno");
  });

  it("says there's nothing to move when every place is on a day", () => {
    show([planned]);
    expect(
      screen.getByText(
        "Nothing to move: every selected place is already on a day.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
  });
});
