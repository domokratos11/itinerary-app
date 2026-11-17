import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CityNotesScreen } from "@/components/city-notes-screen";
import { applyCityResult } from "@/domain/city-notes";
import { useAuthStore } from "@/lib/auth-store";
import { LocalCityNotesRepository } from "@/lib/local-city-notes-repository";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";
import { SAMPLE_BRIEF } from "@/test/sample-city-notes";

let search = new URLSearchParams();
let wide = false;
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));
vi.mock("@/lib/use-trip-id", () => ({ useTripId: () => "trip" }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => wide }));
vi.mock("@/lib/city-notes-repository-instance", () => ({
  cityNotesRepository: {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const now = new Date("2026-12-01T10:00:00.000Z");

async function repoWithNagoya() {
  const repository = new LocalCityNotesRepository();
  await repository.save(
    "trip",
    applyCityResult(
      null,
      { cityId: "nagoya", notes: SAMPLE_BRIEF, answer: null },
      now,
    )!,
  );
  return repository;
}

describe("CityNotesScreen", () => {
  beforeEach(() => {
    search = new URLSearchParams();
    wide = false;
    useAuthStore.setState({ access: "member" });
    useTripStore.setState({ data: fixtureTrip });
  });

  it("lists the trip's cities in visiting order with their status", async () => {
    render(<CityNotesScreen repository={await repoWithNagoya()} />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Tokyo (Ueno)");
    expect(screen.getByRole("link", { name: /Nagoya/ })).toHaveTextContent(
      "Ready",
    );
  });

  it("shows a city's sections in the app's language", async () => {
    search = new URLSearchParams({ id: "nagoya" });
    render(<CityNotesScreen repository={await repoWithNagoya()} />);
    expect(
      screen.getByRole("heading", { name: "Defining moments" }),
    ).toBeInTheDocument();
    expect(screen.getByText("The great fire")).toBeInTheDocument();
    expect(screen.getByText("鉄板")).toBeInTheDocument();
    // No questions asked yet, so that section is left out.
    expect(
      screen.queryByRole("heading", { name: "Your questions" }),
    ).toBeNull();
  });

  it("sends a specific question and keeps the notes visible", async () => {
    search = new URLSearchParams({ id: "nagoya" });
    const repository = await repoWithNagoya();
    render(<CityNotesScreen repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: "Research specifics" }));
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "Why stone?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() =>
      expect(screen.getByText(/Why stone\?/)).toBeInTheDocument(),
    );
    expect(screen.getByText("The great fire")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeInTheDocument();
  });

  it("offers to request notes for a city without any", async () => {
    search = new URLSearchParams({ id: "tokyo-ueno" });
    const repository = new LocalCityNotesRepository();
    render(<CityNotesScreen repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: "Request notes" }));
    await waitFor(() =>
      expect(screen.getByText("Requested")).toBeInTheDocument(),
    );
  });
});
