import { describe, expect, it } from "vitest";

import { QueuedPlaceSchema, parseMapsLink } from "@/domain/queue";

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
