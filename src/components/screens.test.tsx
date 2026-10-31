import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader, BottomNav } from "@/components/app-header";
import { AppSidebar, AppSidebarProvider } from "@/components/app-sidebar";
import { CitiesScreen } from "@/components/cities-screen";
import { CityScreen } from "@/components/city-screen";
import { DayScreen } from "@/components/day-screen";
import { BudgetScreen } from "@/components/budget-screen";
import { DashboardScreen } from "@/components/dashboard-screen";
import { SettingsScreen } from "@/components/settings-screen";
import { TodayCard } from "@/components/today-card";
import { TripDays } from "@/components/trip-days";
import { useAuthStore } from "@/lib/auth-store";
import { setLocale } from "@/lib/i18n";
import { useTripStore } from "@/lib/trip-store";
import { testPlace } from "@/domain/test-place";
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
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: { isConfigured: () => false },
}));
vi.mock("@/lib/use-walking-legs", () => ({
  useWalkingLegs: () => new Map(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));

const place = testPlace({ cityId: "nagoya" });

const SCREENS: [string, () => ReactNode, string, string][] = [
  ["header", () => <AppHeader />, "Peru", "Peru"],
  ["bottom nav", () => <BottomNav />, "Settings", "Ajustes"],
  ["sidebar", () => <AppSidebar />, "Version 1.2.3", "Versión 1.2.3"],
  ["days", () => <TripDays />, "Days", "Días"],
  ["today", () => <TodayCard />, "Day 1", "Día 1"],
  ["cities", () => <CitiesScreen />, "Cities", "Ciudades"],
  ["city", () => <CityScreen />, "Add place", "Agregar lugar"],
  ["day", () => <DayScreen />, "Full day", "Día completo"],
  ["dashboard", () => <DashboardScreen />, "Dashboard", "Panel"],
  ["budget", () => <BudgetScreen />, "Budget", "Presupuesto"],
  ["settings", () => <SettingsScreen />, "Trip settings", "Ajustes del viaje"],
];

// With nothing mocked away a missing value or key logs an error rather than
// throwing, so these fail on that as well as on a crash.
describe.each([
  ["English", "en", 2],
  ["Spanish", "es", 3],
] as const)("every screen in %s", (_name, locale, column) => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-01T00:00:00.000Z"));
    vi.spyOn(console, "error");
    setLocale(locale);
    search = new URLSearchParams({ date: "2026-12-18", id: "nagoya" });
    useTripStore.setState({ data: { ...fixtureTrip, places: [place] } });
    useAuthStore.setState({
      status: "signed-in",
      user: { uid: "u1", email: "ana@example.com", name: "Ana" },
      tripId: "trip-1",
      access: "member",
      trips: [{ id: "trip-1", name: "Peru", members: ["ana@example.com"] }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setLocale("en");
  });

  it.each(SCREENS)("%s", (...row) => {
    const [, ui] = row;
    render(<AppSidebarProvider>{ui()}</AppSidebarProvider>);
    expect(screen.getAllByText(row[column]).length).toBeGreaterThan(0);
    expect(console.error).not.toHaveBeenCalled();
  });
});
