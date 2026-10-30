import { describe, expect, it } from "vitest";

import {
  costTotal,
  dayRunsLate,
  directionsUrl,
  holidayWarnings,
  hotelsForDay,
  itemsForDay,
  keyAt,
  keysForInsert,
  legsForDay,
  nextStop,
  newPlanItem,
  parseHours,
  stopTimes,
  stopWarnings,
  timeWarnings,
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

describe("keysForInsert", () => {
  // Applies the result and returns the day's ids in their new order.
  function orderAfter(others: PlanItem[], moved: PlanItem, index: number) {
    const { order, rekeyed } = keysForInsert(others, index);
    const changed = new Map(rekeyed.map((r) => [r.id, r.order]));
    return [
      ...others.map((i) => ({ ...i, order: changed.get(i.id) ?? i.order })),
      { ...moved, order },
    ]
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
      .map((i) => i.id);
  }

  it("keys only the moved item when the day's keys are distinct", () => {
    const others = [
      item({ id: "a", order: "a0" }),
      item({ id: "b", order: "a1" }),
    ];
    const result = keysForInsert(others, 1);
    expect(result.rekeyed).toEqual([]);
    expect(result.order > "a0" && result.order < "a1").toBe(true);
  });

  it("re-keys the day when two neighbours share a key", () => {
    // A restored stop can share its key with one added while it was removed.
    const others = [
      item({ id: "a", order: "a0" }),
      item({ id: "b", order: "a1" }),
      item({ id: "c", order: "a1" }),
    ];
    const moved = item({ id: "m", order: "a2" });
    expect(orderAfter(others, moved, 2)).toEqual(["a", "b", "m", "c"]);
    expect(keysForInsert(others, 2).rekeyed.length).toBeGreaterThan(0);
  });

  it("re-keys the day when a key is not a valid order key", () => {
    const others = [
      item({ id: "a", order: "1" }),
      item({ id: "b", order: "2" }),
    ];
    const moved = item({ id: "m", order: "a0" });
    expect(orderAfter(others, moved, 1)).toEqual(["a", "m", "b"]);
  });

  it("appends to an empty day", () => {
    expect(keysForInsert([], 0)).toEqual({ order: "a0", rekeyed: [] });
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

describe("stop times", () => {
  const place = { durationMin: 90, openingHours: "about 10:00-21:00 (verify)" };

  it("reads the first hours range from free text", () => {
    expect(parseHours("9:30-17:00, last entry 16:00")).toEqual({
      open: "09:30",
      close: "17:00",
    });
    expect(parseHours("Verify on the day")).toBeNull();
    expect(parseHours(null)).toBeNull();
  });

  it("ends a stop after its duration, or the place's typical one", () => {
    expect(stopTimes({ startTime: "10:30", durationMin: null }, place)).toEqual(
      { start: "10:30", end: "12:00" },
    );
    expect(stopTimes({ startTime: "23:30", durationMin: 60 }, place)?.end).toBe(
      "24:30",
    );
    expect(stopTimes({ startTime: null, durationMin: 60 }, place)).toBeNull();
  });

  it("warns when a stop is outside the opening hours", () => {
    expect(
      timeWarnings({ startTime: "09:00", durationMin: 60 }, place),
    ).toEqual(["May not be open yet (opens 10:00)"]);
    expect(
      timeWarnings({ startTime: "20:00", durationMin: 90 }, place),
    ).toEqual(["May be closed by then (closes 21:00)"]);
    expect(
      timeWarnings({ startTime: "12:00", durationMin: 60 }, place),
    ).toEqual([]);
  });

  it("flags a day that runs past 22:00", () => {
    const places = new Map([["p", { durationMin: 120 }]]);
    expect(
      dayRunsLate(
        [{ placeId: "p", startTime: "21:00", durationMin: null }],
        places,
      ),
    ).toBe("23:00");
    expect(
      dayRunsLate(
        [{ placeId: "p", startTime: "18:00", durationMin: null }],
        places,
      ),
    ).toBeNull();
  });
});

describe("holidayWarnings", () => {
  const holidays = [
    { date: "2026-12-31", kind: "closures" as const },
    { date: "2027-01-11", kind: "holiday" as const },
  ];
  const museum = { category: "sight" as const, closedDates: [] as string[] };

  it("warns about stops in the New Year closures and on holidays", () => {
    expect(holidayWarnings(museum, "2026-12-31", holidays)).toEqual([
      "New Year closures: check it's open",
    ]);
    expect(holidayWarnings(museum, "2027-01-11", holidays)).toEqual([
      "Holiday: check it's open",
    ]);
    expect(holidayWarnings(museum, "2026-12-20", holidays)).toEqual([]);
  });

  it("skips temples and places already marked closed that day", () => {
    expect(
      holidayWarnings(
        { ...museum, category: "temple" },
        "2026-12-31",
        holidays,
      ),
    ).toEqual([]);
    expect(
      holidayWarnings(
        { ...museum, closedDates: ["2026-12-31"] },
        "2026-12-31",
        holidays,
      ),
    ).toEqual([]);
  });
});
