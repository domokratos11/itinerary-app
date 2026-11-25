import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FoodScreen } from "@/components/food-screen";
import { applyFoodResult, foodCategories } from "@/domain/food";
import { useAuthStore } from "@/lib/auth-store";
import { LocalFoodRepository } from "@/lib/local-food-repository";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";
import { sampleSpot } from "@/test/sample-food";

let search = new URLSearchParams();
let wide = false;
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));
vi.mock("@/lib/use-trip-id", () => ({ useTripId: () => "trip" }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => wide }));
vi.mock("@/lib/food-repository-instance", () => ({ foodRepository: {} }));
vi.mock("@/lib/maps-service-instance", () => ({
  mapsService: {
    isConfigured: () => true,
    createMap: () =>
      Promise.resolve({
        update: vi.fn(),
        fit: vi.fn(),
        focus: vi.fn(),
        destroy: vi.fn(),
      }),
  },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const now = new Date("2026-12-01T10:00:00.000Z");

async function repoWithSpots() {
  const repository = new LocalFoodRepository();
  const { added } = applyFoodResult(
    [],
    foodCategories([]),
    {
      cityId: "nagoya",
      spots: [
        sampleSpot(),
        sampleSpot({
          name: "Eel Corner",
          categoryId: "specialty",
          dish: "Hitsumabushi",
        }),
      ],
    },
    now,
  );
  for (const spot of added) await repository.saveSpot("trip", spot);
  return repository;
}

describe("FoodScreen", () => {
  beforeEach(() => {
    search = new URLSearchParams();
    wide = false;
    useAuthStore.setState({ access: "member" });
    useTripStore.setState({ data: fixtureTrip });
  });

  it("lists the trip's cities with how many spots each has", async () => {
    render(<FoodScreen repository={await repoWithSpots()} />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Tokyo (Ueno)");
    expect(links[0]).toHaveTextContent("No spots yet");
    expect(screen.getByRole("link", { name: /Nagoya/ })).toHaveTextContent(
      "2 spots",
    );
  });

  it("shows a city's spots by category with links to Google Maps", async () => {
    search = new URLSearchParams({ id: "nagoya" });
    render(<FoodScreen repository={await repoWithSpots()} />);
    expect(
      screen.getByRole("heading", { name: "Food in Nagoya" }),
    ).toBeVisible();
    const specialty = screen.getByRole("region", { name: /Local specialty/ });
    expect(within(specialty).getByText("Hitsumabushi")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Sample Ramen House" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("query=Sample%20Ramen%20House%20Nagoya"),
    );
    const general = screen.getByRole("link", {
      name: "Search ramen in Google Maps",
    });
    expect(decodeURIComponent(general.getAttribute("href")!)).toContain(
      "ramen near Sample Hotel Nagoya, Nagoya",
    );
  });

  it("filters by category and by stars", async () => {
    search = new URLSearchParams({ id: "nagoya" });
    const repository = await repoWithSpots();
    render(<FoodScreen repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: /^Ramen/ }));
    expect(screen.queryByText("Eel Corner")).toBeNull();
    expect(screen.getByText("Sample Ramen House")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Star Sample Ramen House" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Unstar Sample Ramen House" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Starred/ }));
    expect(screen.queryByText("Eel Corner")).toBeNull();
    expect(screen.getByText("Sample Ramen House")).toBeVisible();
  });

  it("adds a member's own spot", async () => {
    search = new URLSearchParams({ id: "nagoya" });
    const repository = await repoWithSpots();
    render(<FoodScreen repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a spot" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Corner Café" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Corner Café")).toBeVisible());
    expect(screen.getByText("Added by you")).toBeVisible();
  });

  it("adds a custom category and asks research for it", async () => {
    search = new URLSearchParams({ id: "nagoya" });
    wide = true;
    const repository = await repoWithSpots();
    render(<FoodScreen repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.change(screen.getByLabelText("New category"), {
      target: { value: "Izakaya" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(screen.getAllByText("Izakaya").length).toBeGreaterThan(0),
    );
    const asks = screen.getAllByRole("button", { name: "Ask for research" });
    fireEvent.click(asks.at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() =>
      expect(screen.getAllByText("Research asked").length).toBeGreaterThan(0),
    );
  });

  it("shows the map beside the list on a wide screen", async () => {
    search = new URLSearchParams({ id: "nagoya" });
    wide = true;
    render(<FoodScreen repository={await repoWithSpots()} />);
    expect(screen.queryByRole("radio", { name: "Map" })).toBeNull();
    expect(
      screen.getByText(/2 of 2 spots aren't on the map yet/),
    ).toBeVisible();
  });
});
