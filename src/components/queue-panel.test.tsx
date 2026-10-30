import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueuePanel } from "@/components/queue-panel";
import { queueAdd } from "@/lib/queue-actions";
import { toast } from "sonner";

vi.mock("@/lib/use-trip-id", () => ({ useTripId: () => "trip-1" }));
vi.mock("@/lib/use-queue", () => ({
  useQueue: () => ({ items: [], error: null }),
}));
vi.mock("@/lib/queue-actions", () => ({ queueAdd: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const link = "https://maps.app.goo.gl/GJABpeNVfz7KcobC6";

describe("QueuePanel", () => {
  beforeEach(() => {
    vi.mocked(queueAdd).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("confirms and clears the form once the link is queued", async () => {
    vi.mocked(queueAdd).mockResolvedValue(undefined);
    render(<QueuePanel />);

    fireEvent.change(screen.getByLabelText("Google Maps link"), {
      target: { value: link },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to queue" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Queued for the next update"),
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Google Maps link")).toHaveValue("");
  });

  it("reports a refused write and keeps the link so it can be retried", async () => {
    vi.mocked(queueAdd).mockRejectedValue(new Error("permission-denied"));
    render(<QueuePanel />);

    fireEvent.change(screen.getByLabelText("Google Maps link"), {
      target: { value: link },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to queue" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "That link was refused. Check the trip link.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Google Maps link")).toHaveValue(link);
  });
});
