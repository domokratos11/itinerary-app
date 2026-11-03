import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppGate } from "@/components/app-gate";
import { AppHeader, BottomNav } from "@/components/app-header";
import { AppSidebar, AppSidebarProvider } from "@/components/app-sidebar";
import { BudgetScreen } from "@/components/budget-screen";
import { CitiesScreen } from "@/components/cities-screen";
import { CityScreen } from "@/components/city-screen";
import { DashboardScreen } from "@/components/dashboard-screen";
import { DayScreen } from "@/components/day-screen";
import { SettingsScreen } from "@/components/settings-screen";
import { TripDays } from "@/components/trip-days";
import { toSharedTrip, type Share } from "@/domain/share";
import { testPlace } from "@/domain/test-place";
import { useAuthStore } from "@/lib/auth-store";
import { LocalShareRepository } from "@/lib/local-share-repository";
import { usePlanStore } from "@/lib/plan-store";
import { useShareSync } from "@/lib/use-share-sync";
import { useTripStore } from "@/lib/trip-store";
import { useViewerStore, viewerShareId } from "@/lib/viewer-store";
import { fixtureTrip } from "@/test/fixture-trip";

let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => search,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/lib/use-proposals", () => ({ useProposals: () => [] }));
vi.mock("@/lib/use-activity", () => ({
  useActivity: () => ({ entries: [], error: null }),
}));
vi.mock("@/lib/auth", () => ({ signInWithGoogle: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/app-reset", () => ({
  APP_VERSION: "1.2.3",
  resetApp: vi.fn(),
}));
vi.mock("@/lib/version-check", () => ({ checkForUpdate: vi.fn() }));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/user-repository-instance", () => ({ userRepository: {} }));
vi.mock("@/lib/share-repository-instance", () => ({ shareRepository: {} }));
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: { isConfigured: () => false },
}));
vi.mock("@/lib/use-walking-legs", () => ({
  useWalkingLegs: () => new Map(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

const NOW = new Date("2026-11-02T00:00:00.000Z");

// A place with a price, to prove the screens hide it even if one reached
// them; the real copy never has one.
const place = {
  ...testPlace({ id: "castle", cityId: "nagoya", name: "Nagoya Castle" }),
  costEstimateJPY: 3000,
};

const share: Share = {
  id: "abcdefghijklmnopqrstuv",
  tripId: "trip-1",
  tripName: "Peru",
  label: "Grandma",
  createdAt: NOW.toISOString(),
  expiresAt: "2026-11-09T00:00:00.000Z",
  revoked: false,
  publishedAt: NOW.toISOString(),
};

function asViewer() {
  useAuthStore.setState({
    status: "loading",
    user: null,
    trips: null,
    tripId: null,
    access: "checking",
    canCreateTrips: false,
  });
  useViewerStore.setState({ status: "active", share });
  useTripStore.setState({
    data: {
      ...fixtureTrip,
      places: [place],
      expenses: [
        {
          id: "dinner",
          title: "Dinner",
          amountJPY: 8000,
          category: "food",
          date: "2026-12-18",
          status: "paid",
          paidBy: null,
          placeId: null,
          reservationId: null,
          stayId: null,
          note: null,
          archived: false,
          updatedAt: NOW.toISOString(),
        },
      ],
    },
    loaded: {
      cities: true,
      stays: true,
      reservations: true,
      places: true,
      holidays: true,
      expenses: true,
      flights: true,
    },
    error: null,
  });
  usePlanStore.setState({
    ready: true,
    items: [
      {
        id: "i1",
        placeId: "castle",
        date: "2026-12-18",
        order: "a",
        status: "planned",
        updatedAt: NOW.toISOString(),
      },
    ],
  });
}

const SCREENS: [string, () => ReactNode][] = [
  ["header", () => <AppHeader />],
  ["bottom nav", () => <BottomNav />],
  ["sidebar", () => <AppSidebar />],
  ["days", () => <TripDays />],
  ["cities", () => <CitiesScreen />],
  ["city", () => <CityScreen />],
  ["day", () => <DayScreen />],
  ["dashboard", () => <DashboardScreen />],
  ["budget", () => <BudgetScreen />],
  ["settings", () => <SettingsScreen />],
];

// Words that only belong to changing something or to money.
const FORBIDDEN = [
  /\bSettings\b/,
  /\bBudget\b/,
  /Add place/,
  /Went/,
  /\bSkip\b/,
  /Remove/,
  /Log cost/,
  /Archive/,
  /Edit/,
  /Activity/,
  /Sign out/,
  /Export/,
  /Move up|Move down/,
  /Drag/,
  /Hide amounts|Show amounts/,
  /¥|\$|JPY|USD/,
];

describe("a read-only link", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
    vi.spyOn(console, "error");
    search = new URLSearchParams({ date: "2026-12-18", id: "nagoya" });
    asViewer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    useViewerStore.setState({ status: "off", share: null });
  });

  it.each(SCREENS)("%s offers no change and no amount", (_name, ui) => {
    const { container } = render(
      <AppSidebarProvider>{ui()}</AppSidebarProvider>,
    );
    const text = [
      container.textContent ?? "",
      ...[...container.querySelectorAll("[aria-label],[title]")].map(
        (el) =>
          `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`,
      ),
    ].join(" ");
    for (const word of FORBIDDEN) expect(text).not.toMatch(word);
    expect(container.querySelector("input, textarea")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("still shows the trip, its stops and the views", () => {
    render(
      <AppSidebarProvider>
        <AppHeader />
        <DayScreen />
      </AppSidebarProvider>,
    );
    expect(screen.getAllByText("Peru").length).toBeGreaterThan(0);
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.getByText("Nagoya Castle")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Map" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Shared view options" }),
    ).toBeInTheDocument();
  });

  it("shows Budget and Settings as not part of it", () => {
    render(<BudgetScreen />);
    expect(
      screen.getByText("Not part of this shared trip"),
    ).toBeInTheDocument();
  });

  it("closes in the gate once it has expired", () => {
    useViewerStore.setState({ status: "closed", share: null });
    render(
      <AppGate>
        <p>the app</p>
      </AppGate>,
    );
    expect(screen.queryByText("the app")).toBeNull();
    expect(screen.getByText("This link isn't open")).toBeInTheDocument();
  });
});

describe("useShareSync", () => {
  afterEach(() => {
    vi.useRealTimers();
    useViewerStore.setState({ status: "off", share: null });
    useTripStore.getState().reset();
    usePlanStore.getState().reset();
  });

  async function makeLink(now: () => Date) {
    const repository = new LocalShareRepository(now);
    const made = await repository.create(
      {
        tripId: "trip-1",
        tripName: "Peru",
        label: "Grandma",
        expiresAt: "2026-11-09T00:00:00.000Z",
      },
      toSharedTrip({ ...fixtureTrip, places: [place] }, [], NOW),
    );
    return { repository, made };
  }

  it("fills the stores from the copy, without amounts", async () => {
    const { repository, made } = await makeLink(() => NOW);
    renderHook(() => useShareSync(made.id, repository));
    await waitFor(() =>
      expect(useViewerStore.getState().status).toBe("active"),
    );
    const data = useTripStore.getState().data;
    expect(data.places[0].name).toBe("Nagoya Castle");
    expect(data.places[0].costEstimateJPY).toBeNull();
    expect(data.expenses).toEqual([]);
    expect(usePlanStore.getState().ready).toBe(true);
  });

  it("closes a revoked or unknown link", async () => {
    const { repository, made } = await makeLink(() => NOW);
    await repository.revoke(made);
    renderHook(() => useShareSync(made.id, repository));
    await waitFor(() =>
      expect(useViewerStore.getState().status).toBe("closed"),
    );
    expect(useTripStore.getState().data.places).toEqual([]);
  });

  it("closes an open link the minute it expires", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "Date"] });
    vi.setSystemTime(new Date("2026-11-08T23:59:30.000Z"));
    const { repository, made } = await makeLink(() => new Date());
    renderHook(() => useShareSync(made.id, repository));
    await act(async () => {
      await Promise.resolve();
    });
    expect(useViewerStore.getState().status).toBe("active");
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(useViewerStore.getState().status).toBe("closed");
    expect(useTripStore.getState().data.places).toEqual([]);
  });
});

describe("viewerShareId", () => {
  afterEach(() => sessionStorage.clear());

  it("starts from ?share=, stays for the tab and ends with ?trip=", () => {
    const id = "abcdefghijklmnopqrstuv";
    expect(viewerShareId(id, null)).toBe(id);
    expect(viewerShareId(null, null)).toBe(id);
    expect(viewerShareId(null, "trip-123")).toBeNull();
    expect(viewerShareId(null, null)).toBeNull();
    expect(viewerShareId("bad id", null)).toBeNull();
  });
});
