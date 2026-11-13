import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DayPlan } from "@/components/day-plan";
import { newPlanItem } from "@/domain/plan";
import { testPlace } from "@/domain/test-place";
import { useAuthStore } from "@/lib/auth-store";
import { LocationError, currentPosition } from "@/lib/device-location";
import { addPlaceAt, updateItem } from "@/lib/plan-actions";
import { usePlanStore } from "@/lib/plan-store";
import { todayInTokyo } from "@/lib/tokyo-date";
import { saveRecord } from "@/lib/trip-actions";
import { useTripStore } from "@/lib/trip-store";
import { useViewerStore } from "@/lib/viewer-store";
import { fixtureTrip } from "@/test/fixture-trip";

const nearbyPlaces = vi.fn();
const suggestPlaces = vi.fn(() => Promise.resolve([]));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/day/",
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/lib/use-walking-legs", () => ({
  useWalkingLegs: () => new Map(),
}));
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: {
    isConfigured: () => true,
    nearbyPlaces: (...args: unknown[]) => nearbyPlaces(...args),
    suggestPlaces: (...args: unknown[]) => suggestPlaces(...(args as [])),
    locatePlace: vi.fn(),
  },
}));
vi.mock("@/lib/device-location", async (original) => ({
  ...(await original<typeof import("@/lib/device-location")>()),
  currentPosition: vi.fn(),
}));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/trip-actions", () => ({
  saveRecord: vi.fn(() => Promise.resolve()),
  archiveRecord: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/plan-actions", () => ({
  addPlaceAt: vi.fn(),
  placeItem: vi.fn(),
  removeItem: vi.fn(() => Promise.resolve()),
  restoreItem: vi.fn(),
  updateItem: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/components/trip-map", () => ({ TripMap: () => null }));

const DATE = todayInTokyo();
const zoo = testPlace({ id: "zoo", name: "Ueno Zoo", cityId: "nagoya" });
const castle = testPlace({
  id: "castle",
  name: "Nagoya Castle",
  cityId: "nagoya",
});
const NOW = new Date("2026-11-01T00:00:00.000Z");
const stops = [
  newPlanItem({ id: "s1", placeId: "zoo", date: DATE, order: "a0", now: NOW }),
  newPlanItem({
    id: "s2",
    placeId: "castle",
    date: DATE,
    order: "a1",
    now: NOW,
  }),
];

function dayPlan() {
  render(
    <DayPlan
      date={DATE}
      label="Today"
      cityNames={["Nagoya"]}
      cityIds={["nagoya"]}
      start={null}
      end={null}
      reservations={[]}
      flights={[]}
    />,
  );
}

const plusButtons = () =>
  screen.queryAllByRole("button", { name: "Add a place here" });

beforeEach(() => {
  vi.clearAllMocks();
  useViewerStore.setState({ status: "off", share: null });
  useTripStore.setState({ data: { ...fixtureTrip, places: [zoo, castle] } });
  usePlanStore.setState({ items: stops });
  useAuthStore.setState({ tripId: "trip-1", access: "member" });
  vi.mocked(addPlaceAt).mockResolvedValue({ ...stops[0], id: "new" });
});

describe("the + in the day's line", () => {
  it("is in every gap: N stops, N + 1 of them", () => {
    dayPlan();
    expect(plusButtons()).toHaveLength(3);
  });

  it("is one gap on an empty day", () => {
    usePlanStore.setState({ items: [] });
    dayPlan();
    expect(plusButtons()).toHaveLength(1);
  });

  it("is absent on a read-only link", () => {
    useViewerStore.setState({ status: "active", share: null });
    dayPlan();
    expect(plusButtons()).toHaveLength(0);
  });

  it("is a 44px target on phones and quiet from lg", () => {
    dayPlan();
    const button = plusButtons()[0];
    expect(button.className).toContain("size-11");
    expect(button.className).toContain("md:size-7");
    expect(button.firstElementChild?.className).toContain("lg:opacity-60");
    expect(button.firstElementChild?.className).toContain(
      "lg:group-hover/plus:opacity-100",
    );
  });
});

describe("adding a nearby place", () => {
  it("creates the place at the gap and marks it done when here now", async () => {
    vi.mocked(currentPosition).mockResolvedValue({ lat: 35.18, lng: 136.9 });
    nearbyPlaces.mockResolvedValue([
      {
        placeId: "g1",
        name: "Ichiran Ramen",
        primaryType: "ramen_restaurant",
        location: { lat: 35.1801, lng: 136.9001 },
        distanceM: 120,
      },
    ]);
    dayPlan();
    fireEvent.click(plusButtons()[1]);
    expect(await screen.findByText("Ichiran Ramen")).toBeInTheDocument();
    expect(screen.getByText("Ramen restaurant")).toBeInTheDocument();
    expect(screen.getByText("120 m")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ichiran Ramen"));

    // Category guessed from Google's type; here-now is on for today.
    expect(
      screen.getByRole("combobox", { name: "Category" }),
    ).toHaveTextContent("Food");
    expect(screen.getByRole("switch", { name: "I'm here now" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Add stop" }));

    await waitFor(() => expect(addPlaceAt).toHaveBeenCalled());
    const place = vi.mocked(saveRecord).mock.calls[0][2] as {
      id: string;
      googlePlaceId: string;
      locationSource: string;
      locationFetchedAt: string | null;
      category: string;
      cityId: string;
    };
    expect(place.googlePlaceId).toBe("g1");
    expect(place.locationSource).toBe("google");
    expect(place.locationFetchedAt).not.toBeNull();
    expect(place.category).toBe("food");
    expect(place.cityId).toBe("nagoya");
    expect(addPlaceAt).toHaveBeenCalledWith(
      "trip-1",
      place.id,
      DATE,
      1,
      expect.any(Array),
    );
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith(
        "trip-1",
        expect.objectContaining({ id: "new" }),
        { status: "done" },
      ),
    );
  });

  it("falls back to searching by name when location is refused", async () => {
    vi.mocked(currentPosition).mockRejectedValue(new LocationError("denied"));
    dayPlan();
    fireEvent.click(plusButtons()[0]);
    expect(await screen.findByText(/Location is blocked/)).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Search by name" }),
    ).toBeInTheDocument();
    expect(nearbyPlaces).not.toHaveBeenCalled();
  });
});
