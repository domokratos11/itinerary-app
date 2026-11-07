import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSyncStore } from "@/lib/sync-store";

import { SyncStatus } from "./sync-status";

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

describe("SyncStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useSyncStore.setState({ pending: 0, startup: false });
  });

  it("says everything is saved", () => {
    setOnline(true);
    render(<SyncStatus />);
    expect(screen.getByRole("button", { name: "All changes saved" }));
  });

  it("counts changes being sent", () => {
    setOnline(true);
    useSyncStore.setState({ pending: 2 });
    render(<SyncStatus />);
    expect(screen.getByRole("button", { name: "Saving 2 changes…" }));
  });

  it("counts changes waiting offline", () => {
    setOnline(false);
    useSyncStore.setState({ pending: 1 });
    render(<SyncStatus />);
    expect(
      screen.getByRole("button", {
        name: "1 change waiting for a connection.",
      }),
    ).toHaveAttribute("data-status", "waiting");
  });
});
