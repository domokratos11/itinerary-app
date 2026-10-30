import { describe, expect, it } from "vitest";

import {
  QueuedPlaceSchema,
  draftPlaceFrom,
  isDraft,
  parseMapsLink,
  suggestCity,
} from "@/domain/queue";
import { PlaceRecordSchema } from "@/domain/schemas";

const full =
  "https://www.google.com/maps/place/Oasis+21/@35.1711148,136.9069008,17z/data=!3m1!4b1!4m6!3m5!1s0x600370d429e2994f:0x54bee562b7bb83d6!8m2!3d35.1711148!4d136.9094757";

describe("parseMapsLink", () => {
  it("reads the name and exact pin from a full place link", () => {
    expect(parseMapsLink(full)).toEqual({
      name: "Oasis 21",
      lat: 35.1711148,
      lng: 136.9094757,
    });
  });

  it("accepts a short link but leaves the details to the enrichment run", () => {
    expect(parseMapsLink("https://maps.app.goo.gl/GJABpeNVfz7KcobC6")).toEqual({
      name: null,
      lat: null,
      lng: null,
    });
  });

  it("rejects anything that is not a Google Maps link", () => {
    expect(parseMapsLink("https://example.com/maps/place/x")).toBeNull();
    expect(parseMapsLink("http://maps.app.goo.gl/abc")).toBeNull();
    expect(parseMapsLink("not a url")).toBeNull();
  });

  it("falls back to the @ coordinates when there is no pin", () => {
    const link =
      "https://www.google.com/maps/place/Nagoya+Castle/@35.1847501,136.8971134,17z";
    expect(parseMapsLink(link)).toEqual({
      name: "Nagoya Castle",
      lat: 35.1847501,
      lng: 136.8971134,
    });
  });
});

describe("QueuedPlaceSchema", () => {
  it("accepts a queued link with no details yet", () => {
    const result = QueuedPlaceSchema.safeParse({
      id: "q1",
      url: "https://maps.app.goo.gl/GJABpeNVfz7KcobC6",
      name: null,
      lat: null,
      lng: null,
      note: null,
      createdAt: "2026-10-29T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a bad coordinate", () => {
    const result = QueuedPlaceSchema.safeParse({
      id: "q1",
      url: "https://maps.app.goo.gl/x",
      name: null,
      lat: 135,
      lng: null,
      note: null,
      createdAt: "2026-10-29T12:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("queue lifecycle", () => {
  const saved = QueuedPlaceSchema.parse({
    id: "q1",
    url: full,
    name: "Oasis 21",
    lat: 35.1711148,
    lng: 136.9094757,
    note: "Night view",
    createdAt: "2026-10-29T12:00:00.000Z",
  });

  it("reads links saved before statuses existed as queued", () => {
    expect(saved).toMatchObject({
      status: "queued",
      cityId: null,
      placeId: null,
      updatedAt: null,
    });
  });

  it("suggests the city with the nearest saved place", () => {
    const places = [
      { cityId: "tokyo-ueno", lat: 35.7141, lng: 139.7774 },
      { cityId: "nagoya", lat: 35.1847, lng: 136.8971 },
    ];
    expect(suggestCity(saved, places)).toBe("nagoya");
  });

  it("suggests nothing when every place is far away or the link has no location", () => {
    const tokyo = [{ cityId: "tokyo-ueno", lat: 35.7141, lng: 139.7774 }];
    expect(suggestCity(saved, tokyo)).toBeNull();
    expect(suggestCity({ lat: null, lng: null }, tokyo)).toBeNull();
  });

  it("makes a draft place from the link", () => {
    const place = draftPlaceFrom(
      saved,
      { cityId: "nagoya", name: "Oasis 21", takenIds: ["q-oasis-21"] },
      new Date("2026-11-01T00:00:00.000Z"),
    );
    expect(place).toMatchObject({
      id: "q-oasis-21-2",
      cityId: "nagoya",
      mapsUrl: full,
      lat: 35.1711148,
      purpose: "Night view",
      status: "draft",
      source: "queue",
    });
    expect(PlaceRecordSchema.safeParse(place).success).toBe(true);
    expect(isDraft(place)).toBe(true);
  });

  it("keeps the category chosen in the queue, and defaults to sight", () => {
    const input = { cityId: "nagoya", name: "Oasis 21", takenIds: [] };
    const now = new Date("2026-11-01T00:00:00.000Z");
    expect(
      draftPlaceFrom({ ...saved, category: "lights" }, input, now).category,
    ).toBe("lights");
    expect(
      draftPlaceFrom({ ...saved, category: null }, input, now).category,
    ).toBe("sight");
  });

  it("reads links saved before categories existed", () => {
    const old: Record<string, unknown> = { ...saved };
    delete old.category;
    expect(QueuedPlaceSchema.parse(old).category).toBeNull();
  });
});
