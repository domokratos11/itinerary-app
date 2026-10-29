import { describe, expect, it } from "vitest";

import {
  costTotal,
  directionsUrl,
  hotelsForDay,
  itemsForDay,
  keyAt,
  legsForDay,
  nextStop,
  newPlanItem,
  stopWarnings,
} from "@/domain/plan";
import type { PlanItem, Place, Stay } from "@/domain/schemas";

const stay = (cityId: string, checkIn: string, checkOut: string): Stay => ({
  cityId,
  hotelName: `${cityId} hotel`,
  hotelMapsUrl: null,
  lat: null,
  lng: null,
  checkIn,
  checkOut,
});

const stays = [
  stay("tokyo-ueno", "2026-12-17", "2026-12-24"),
  stay("nagoya", "2026-12-24", "2026-12-27"),
  stay("hiroshima", "2026-12-27", "2026-12-30"),
];

const item = (overrides: Partial<PlanItem>): PlanItem => ({
  id: "i",
  placeId: "p",
  date: "2026-12-20",
  order: "a0",
  startTime: null,
  durationMin: null,
  note: null,
  status: "planned",
  updatedAt: "2026-10-28T00:00:00.000Z",
  ...overrides,
});

describe("itemsForDay", () => {
  it("returns the day's active items sorted by order, without removed ones", () => {
    const items = [
      item({ id: "b", order: "a1" }),
      item({ id: "a", order: "a0" }),
      item({ id: "gone", order: "a0V", status: "removed" }),
      item({ id: "other-day", date: "2026-12-21", order: "a0" }),
    ];
    expect(itemsForDay(items, "2026-12-20").map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("hotelsForDay", () => {
  it("uses the same hotel at both ends of an ordinary day", () => {
    const { start, end } = hotelsForDay("2026-12-20", stays);
    expect(start?.cityId).toBe("tokyo-ueno");
    expect(end?.cityId).toBe("tokyo-ueno");
  });

  it("starts at the old hotel and ends at the new one on a transfer day", () => {
    const { start, end } = hotelsForDay("2026-12-27", stays);
    expect(start?.cityId).toBe("nagoya");
    expect(end?.cityId).toBe("hiroshima");
  });

  it("starts from the arrival hotel on the first day", () => {
    const { start, end } = hotelsForDay("2026-12-17", stays);
    expect(start?.cityId).toBe("tokyo-ueno");
    expect(end?.cityId).toBe("tokyo-ueno");
  });

  it("ends at the last hotel on the final check-out day", () => {
    const { start, end } = hotelsForDay("2026-12-30", [...stays]);
    expect(start?.cityId).toBe("hiroshima");
    expect(end?.cityId).toBe("hiroshima");
  });
});

describe("directionsUrl", () => {
  it("uses coordinates and transit mode, with an origin when given", () => {
    expect(
      directionsUrl({ lat: 35.1, lng: 136.9 }, { lat: 35.2, lng: 136.8 }),
    ).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=35.1,136.9&travelmode=transit&origin=35.2,136.8",
    );
  });

  it("omits the origin so Maps uses the current location", () => {
    expect(directionsUrl({ query: "Oasis 21 Japan" })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Oasis%2021%20Japan&travelmode=transit",
    );
  });
});

describe("legsForDay", () => {
  const hotel = { name: "Hotel", location: { query: "Hotel Japan" } };
  const stop = (name: string) => ({
    name,
    location: { query: `${name} Japan` },
  });

  it("links hotel to stops and back to the hotel", () => {
    const legs = legsForDay(hotel, [stop("A"), stop("B")], hotel);
    expect(legs.map((l) => `${l.from} -> ${l.to}`)).toEqual([
      "Hotel -> A",
      "A -> B",
      "B -> Hotel",
    ]);
  });

  it("returns no legs for a day with no stops", () => {
    expect(legsForDay(hotel, [], hotel)).toEqual([]);
  });
});

describe("nextStop", () => {
  it("is the first planned stop, skipping done ones", () => {
    const sorted = [
      item({ id: "done", order: "a0", status: "done" }),
      item({ id: "next", order: "a1" }),
    ];
    expect(nextStop(sorted)?.id).toBe("next");
  });

  it("is null when everything is done", () => {
    expect(nextStop([item({ status: "done" })])).toBeNull();
  });
});

describe("keyAt", () => {
  it("places an item between its neighbours", () => {
    const list = [item({ order: "a0" }), item({ order: "a1" })];
    const key = keyAt(list, 1);
    expect(key > "a0" && key < "a1").toBe(true);
  });

  it("appends after the last item", () => {
    const list = [item({ order: "a0" })];
    expect(keyAt(list, 1) > "a0").toBe(true);
  });
});

describe("newPlanItem", () => {
  it("creates a planned item with an ISO update time", () => {
    const created = newPlanItem({
      id: "new",
      placeId: "n-oasis21",
      date: "2026-12-25",
      order: "a0",
      now: new Date("2026-12-25T09:00:00.000Z"),
    });
    expect(created.status).toBe("planned");
    expect(created.updatedAt).toBe("2026-12-25T09:00:00.000Z");
  });
});

describe("stopWarnings", () => {
  const place = (overrides: Partial<Place>): Place =>
    ({
      id: "p",
      cityId: "nagoya",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=x",
      name: "Place",
      lat: null,
      lng: null,
      category: "sight",
      purpose: null,
      description: null,
      tips: [],
      costEstimateJPY: null,
      durationMin: null,
      openingHours: null,
      closedDates: [],
      seasonFrom: null,
      seasonTo: null,
      priority: "want",
      verifiedAt: null,
      websiteUrl: null,
      notes: null,
      ...overrides,
    }) as Place;

  it("warns on a closed date", () => {
    const p = place({ closedDates: ["2026-12-29"] });
    expect(stopWarnings(p, "2026-12-29")).toEqual(["Closed on this day"]);
    expect(stopWarnings(p, "2026-12-30")).toEqual([]);
  });

  it("warns outside the season on either side", () => {
    const p = place({ seasonFrom: "2026-11-01", seasonTo: "2027-02-14" });
    expect(stopWarnings(p, "2026-10-31")).toEqual(["Outside its season"]);
    expect(stopWarnings(p, "2026-12-20")).toEqual([]);
    expect(stopWarnings(p, "2027-02-15")).toEqual(["Outside its season"]);
  });

  it("gives no warnings when nothing is known", () => {
    expect(stopWarnings(place({}), "2026-12-20")).toEqual([]);
  });
});

describe("costTotal", () => {
  it("adds known costs and counts unknown ones separately", () => {
    const priced = { costEstimateJPY: 1300 } as Place;
    const free = { costEstimateJPY: 0 } as Place;
    const unknown = { costEstimateJPY: null } as Place;
    expect(costTotal([priced, free, unknown, undefined])).toEqual({
      yen: 1300,
      unpriced: 2,
    });
  });
});
