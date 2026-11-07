import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DayResearchPanel } from "@/components/day-research";
import type { DayResearch } from "@/domain/schemas";
import { testPlace } from "@/domain/test-place";
import { useAuthStore } from "@/lib/auth-store";
import { LocalDayResearchRepository } from "@/lib/local-day-research-repository";

const repo = new LocalDayResearchRepository();
const requestResearch = vi.fn(async () => 1);

vi.mock("@/lib/day-research-repository-instance", () => ({
  get dayResearchRepository() {
    return repo;
  },
}));
vi.mock("@/lib/use-proposals", () => ({ useProposals: () => [] }));
vi.mock("@/lib/proposal-actions", () => ({
  requestResearch: (...args: unknown[]) => requestResearch(...(args as [])),
  applyProposals: vi.fn(),
  undoProposals: vi.fn(),
}));
vi.mock("@/lib/use-trip-id", () => ({ useTripId: () => "trip" }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));

const zoo = testPlace({ id: "zoo", name: "Ueno Zoo" });
const placesById = new Map([[zoo.id, zoo]]);

function panel(onOpenPlace = vi.fn()) {
  render(
    <DayResearchPanel
      date="2026-12-18"
      placesOfDay={[zoo]}
      placesById={placesById}
      onOpenPlace={onOpenPlace}
    />,
  );
}

describe("DayResearchPanel", () => {
  beforeEach(() => {
    requestResearch.mockClear();
    useAuthStore.setState({ access: "member" });
  });

  it("asks for the day with a message and researches every stop", async () => {
    panel();
    fireEvent.click(screen.getByRole("button", { name: "Research this day" }));
    fireEvent.change(screen.getByLabelText(/Anything specific/), {
      target: { value: "Any winter lights?" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Request" }));
    });
    expect(requestResearch).toHaveBeenCalledWith("trip", [zoo], []);
    expect(await screen.findByText(/Research requested on/)).toBeTruthy();
    expect(screen.getByText("Your message: Any winter lights?")).toBeTruthy();
  });

  it("shows a ready analysis with its load, warnings and hints", async () => {
    const ready: DayResearch = {
      id: "2026-12-18",
      date: "2026-12-18",
      status: "ready",
      request: "Any winter lights?",
      requestedAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-02T00:00:00.000Z",
      analysis: {
        load: "heavy",
        loadReason: "Six stops across three wards.",
        summary: "Start early.",
        warnings: [
          { kind: "closed", placeIds: ["zoo"], text: "Closed on Mondays." },
        ],
        hints: [
          {
            name: "Ameyoko",
            text: "Five minutes from the zoo.",
            placeId: null,
            mapsUrl: null,
          },
        ],
        answer: "Yes, the park has lights until 22:00.",
        sources: [],
        researchedAt: "2026-11-02T00:00:00.000Z",
      },
    };
    await repo.save("trip", ready);
    const onOpenPlace = vi.fn();
    panel(onOpenPlace);
    // Starts closed: the load and its reason show, the details don't.
    expect(screen.getByText("Heavy day")).toBeTruthy();
    expect(screen.queryByText("Closed on Mondays.")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Show the full analysis" }),
    );
    expect(screen.getByText("Closed on Mondays.")).toBeTruthy();
    expect(
      screen.getByText("Yes, the park has lights until 22:00."),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ameyoko" }).getAttribute("href"),
    ).toContain("google.com/maps/search");
    fireEvent.click(screen.getByRole("button", { name: "Ueno Zoo" }));
    expect(onOpenPlace).toHaveBeenCalledWith("zoo");
  });
});
