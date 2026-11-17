import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { OfflineReadiness } from "@/components/offline-readiness";
import type { TripRepository } from "@/domain/trip-repository";
import { useAuthStore } from "@/lib/auth-store";

vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("OfflineReadiness", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ tripId: "t1" });
    vi.mocked(toast.success).mockReset();
  });

  it("lists what works offline and what needs a connection", async () => {
    render(<OfflineReadiness repository={{} as TripRepository} />);
    expect(await screen.findByText("App pages")).toBeInTheDocument();
    expect(screen.getByText("Not synced on this device yet.")).toBeVisible();
    expect(screen.getByText("Phrasebook, numbers and kanji")).toBeVisible();
    expect(screen.getByText("Needs a connection")).toBeVisible();
  });

  it("reads the trip from the server again on request", async () => {
    const refreshFromServer = vi.fn().mockResolvedValue(42);
    render(
      <OfflineReadiness
        repository={{ refreshFromServer } as unknown as TripRepository}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Check and refresh now" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Up to date: 42 records saved on this device.",
      ),
    );
    expect(refreshFromServer).toHaveBeenCalledWith("t1");
  });
});
