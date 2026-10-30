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

afterEach(() => {
  cleanup();
});
