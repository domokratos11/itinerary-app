import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QueuedPlace } from "@/domain/queue";

const setDoc = vi.fn();
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(() => "ref"),
  onSnapshot: vi.fn(),
  setDoc: (...args: unknown[]) => setDoc(...args),
}));
vi.mock("@/lib/firebase", () => ({ getDb: () => ({}) }));

import { FirestoreQueueRepository } from "@/lib/firestore-queue-repository";

const item: QueuedPlace = {
  id: "q1",
  url: "https://maps.app.goo.gl/x",
  name: null,
  lat: null,
  lng: null,
  note: null,
  createdAt: "2026-10-29T12:00:00.000Z",
  status: "queued",
  cityId: null,
  placeId: null,
  category: null,
  updatedAt: null,
};

describe("FirestoreQueueRepository.save", () => {
  beforeEach(() => setDoc.mockClear());

  it("leaves category out until one is chosen, so older rules still accept it", async () => {
    await new FirestoreQueueRepository().save("t", item);
    expect(setDoc.mock.calls[0][1]).not.toHaveProperty("category");
  });

  it("writes the category once chosen", async () => {
    await new FirestoreQueueRepository().save("t", {
      ...item,
      category: "lights",
    });
    expect(setDoc.mock.calls[0][1]).toMatchObject({ category: "lights" });
  });
});
