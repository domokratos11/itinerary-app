import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueuePanel } from "@/components/queue-panel";
import type { QueuedPlace } from "@/domain/queue";
import { assignQueued, queueAdd, queueUpdate } from "@/lib/queue-actions";
import { toast } from "sonner";

vi.mock("@/lib/use-trip-id", () => ({ useTripId: () => "trip-1" }));
// jsdom has no matchMedia: use the wide layout (Dialog, not Drawer).
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));
let queueItems: QueuedPlace[] = [];
vi.mock("@/lib/use-queue", () => ({
  useQueue: () => ({ items: queueItems, error: null }),
}));
vi.mock("@/lib/queue-actions", () => ({
  queueAdd: vi.fn(),
  queueUpdate: vi.fn(),
  assignQueued: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const link = "https://maps.app.goo.gl/GJABpeNVfz7KcobC6";

describe("QueuePanel", () => {
  beforeEach(() => {
    queueItems = [];
    vi.mocked(queueAdd).mockReset();
    vi.mocked(queueUpdate).mockReset().mockResolvedValue(undefined);
    vi.mocked(assignQueued).mockReset();
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

  const oasis: QueuedPlace = {
    id: "q1",
    url: "https://www.google.com/maps/place/Oasis+21/@35.17,136.9,17z",
    name: "Oasis 21",
    lat: 35.1711148,
    lng: 136.9094757,
    note: null,
    createdAt: "2026-10-29T12:00:00.000Z",
    status: "queued",
    cityId: null,
    placeId: null,
    updatedAt: null,
  };

  it("edits a queued link's name, keeping the suggested city", async () => {
    queueItems = [oasis];
    render(<QueuePanel />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Oasis 21" }));
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Oasis 21 rooftop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(queueUpdate).toHaveBeenCalledWith("trip-1", oasis, {
      name: "Oasis 21 rooftop",
      note: null,
      cityId: "nagoya",
    });
  });

  it("assigns a queued link to the suggested city's first day", async () => {
    vi.mocked(assignQueued).mockResolvedValue({
      place: { name: "Oasis 21" },
      stop: null,
    } as unknown as Awaited<ReturnType<typeof assignQueued>>);

    queueItems = [oasis];
    render(<QueuePanel />);

    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add to day" }));

    expect(assignQueued).toHaveBeenCalledWith(
      "trip-1",
      oasis,
      "nagoya",
      "2026-12-24",
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Added Oasis 21 to Thu, Dec 24",
      ),
    );
  });
});
