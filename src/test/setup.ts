import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Actions log to the activity log; tests keep it in memory instead of
// reaching Firestore.
vi.mock("@/lib/activity-repository-instance", async () => {
  const { LocalActivityRepository } =
    await import("@/lib/local-activity-repository");
  return { activityRepository: new LocalActivityRepository() };
});

// Tooltips measure themselves with this, and jsdom doesn't have it.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// Nothing reaches the network: screens that ask for the weather get no
// answer, as offline. A test that needs fetch stubs its own.
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.reject(new Error("No network in tests"))),
);

afterEach(() => {
  cleanup();
});
