import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const ANA = "ana@example.com";
const BEN = "ben@example.com";
const EVE = "eve@example.com";

let env: RulesTestEnvironment;

function as(email: string): Firestore {
  return env
    .authenticatedContext(email.split("@")[0], {
      email,
      email_verified: true,
    })
    .firestore() as unknown as Firestore;
}

const anonymous = () =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;

const NOW = "2026-11-01T00:00:00.000Z";
const newTrip = (email: string) => ({
  name: "Peru",
  members: [email],
  createdBy: email,
  createdAt: NOW,
  updatedAt: NOW,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-itinerary",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8181,
    },
  });
});

afterAll(() => env.cleanup());

// ANA is on "japan" (made by hand before trips had names) and "peru", BEN on
// "peru" only, EVE on nothing. Only ANA may create trips.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "trips/japan"), { members: [ANA] });
    await setDoc(doc(db, "trips/peru"), { name: "Peru", members: [ANA, BEN] });
    await setDoc(doc(db, "config/access"), { tripCreators: [ANA] });
    await setDoc(doc(db, "trips/japan/cities/tokyo"), {
      id: "tokyo",
      name: "Tokyo",
      color: "#000000",
      archived: false,
      updatedAt: NOW,
    });
  });
});

const myTrips = (db: Firestore, email: string) =>
  query(collection(db, "trips"), where("members", "array-contains", email));

describe("reading a trip", () => {
  it("is open to its members", async () => {
    await assertSucceeds(getDoc(doc(as(ANA), "trips/japan")));
    await assertSucceeds(getDoc(doc(as(ANA), "trips/japan/cities/tokyo")));
  });

  it("is closed to everyone else, signed in or not", async () => {
    await assertFails(getDoc(doc(as(EVE), "trips/japan")));
    await assertFails(getDoc(doc(as(EVE), "trips/japan/cities/tokyo")));
    await assertFails(getDoc(doc(anonymous(), "trips/japan")));
    await assertFails(getDoc(doc(anonymous(), "trips/japan/cities/tokyo")));
  });
});

describe("listing trips", () => {
  it("finds your own trips", async () => {
    await assertSucceeds(getDocs(myTrips(as(ANA), ANA)));
    await assertSucceeds(getDocs(myTrips(as(EVE), EVE)));
  });

  it("refuses someone else's email, and an open-ended list", async () => {
    await assertFails(getDocs(myTrips(as(EVE), ANA)));
    await assertFails(getDocs(collection(as(EVE), "trips")));
    await assertFails(getDocs(collection(as(ANA), "trips")));
    await assertFails(getDocs(myTrips(anonymous(), ANA)));
  });
});

describe("creating a trip", () => {
  it("is allowed for someone on the creators list", async () => {
    await assertSucceeds(setDoc(doc(as(ANA), "trips/new"), newTrip(ANA)));
  });

  it("is refused for anyone else", async () => {
    await assertFails(setDoc(doc(as(EVE), "trips/new"), newTrip(EVE)));
    await assertFails(setDoc(doc(anonymous(), "trips/new"), newTrip(EVE)));
  });

  it("must have its creator as a member", async () => {
    await assertFails(
      setDoc(doc(as(ANA), "trips/new"), { ...newTrip(ANA), members: [BEN] }),
    );
  });

  it("refuses unknown fields", async () => {
    await assertFails(
      setDoc(doc(as(ANA), "trips/new"), { ...newTrip(ANA), extra: true }),
    );
  });
});

describe("changing a trip", () => {
  it("lets a member rename it, even one with no name yet", async () => {
    await assertSucceeds(
      updateDoc(doc(as(ANA), "trips/japan"), { name: "Japan", updatedAt: NOW }),
    );
  });

  it("lets a member add and remove others", async () => {
    await assertSucceeds(
      updateDoc(doc(as(BEN), "trips/peru"), {
        members: [BEN, EVE],
        updatedAt: NOW,
      }),
    );
  });

  it("refuses removing yourself", async () => {
    await assertFails(
      updateDoc(doc(as(BEN), "trips/peru"), {
        members: [ANA],
        updatedAt: NOW,
      }),
    );
  });

  it("refuses anyone who isn't a member adding themselves", async () => {
    await assertFails(
      updateDoc(doc(as(EVE), "trips/peru"), {
        members: [ANA, BEN, EVE],
        updatedAt: NOW,
      }),
    );
  });

  it("refuses other fields and deleting", async () => {
    await assertFails(
      updateDoc(doc(as(ANA), "trips/peru"), { createdBy: EVE }),
    );
    await assertFails(deleteDoc(doc(as(ANA), "trips/peru")));
  });
});

describe("config/access", () => {
  it("is readable only by the people on it, and never writable", async () => {
    await assertSucceeds(getDoc(doc(as(ANA), "config/access")));
    await assertFails(getDoc(doc(as(EVE), "config/access")));
    await assertFails(
      setDoc(doc(as(ANA), "config/access"), { tripCreators: [ANA, EVE] }),
    );
  });
});

describe("users/{uid}", () => {
  const profile = { language: "es", lastTripId: "japan", updatedAt: NOW };

  it("is yours alone", async () => {
    await assertSucceeds(setDoc(doc(as(ANA), "users/ana"), profile));
    await assertSucceeds(getDoc(doc(as(ANA), "users/ana")));
    await assertFails(getDoc(doc(as(EVE), "users/ana")));
    await assertFails(setDoc(doc(as(EVE), "users/ana"), profile));
  });

  it("holds only the known preferences", async () => {
    await assertFails(
      setDoc(doc(as(ANA), "users/ana"), { ...profile, language: "xx" }),
    );
    await assertFails(
      setDoc(doc(as(ANA), "users/ana"), { ...profile, admin: true }),
    );
  });
});

describe("expenses", () => {
  const expense = {
    id: "e1",
    title: "Lunch",
    amountJPY: 1200,
    category: "food",
    date: "2026-12-16",
    status: "paid",
    paidBy: ANA,
    placeId: null,
    reservationId: null,
    stayId: null,
    note: null,
    archived: false,
    updatedAt: NOW,
  };

  it("are saved by members, in the right shape", async () => {
    const path = "trips/japan/expenses/e1";
    await assertSucceeds(setDoc(doc(as(ANA), path), expense));
    await assertFails(setDoc(doc(as(EVE), path), expense));
    await assertFails(
      setDoc(doc(as(ANA), path), { ...expense, amountJPY: 12.5 }),
    );
    await assertFails(
      setDoc(doc(as(ANA), path), { ...expense, category: "bribes" }),
    );
  });

  it("may keep the dollars and rate it was entered with", async () => {
    const path = "trips/japan/expenses/e3";
    const inUsd = {
      ...expense,
      id: "e3",
      amountJPY: 15829,
      originalUSD: 100.5,
      rateJPYPerUSD: 158.29,
    };
    await assertSucceeds(setDoc(doc(as(ANA), path), inUsd));
    await assertSucceeds(
      setDoc(doc(as(ANA), path), {
        ...inUsd,
        originalUSD: null,
        rateJPYPerUSD: null,
      }),
    );
    await assertFails(
      setDoc(doc(as(ANA), path), { ...inUsd, originalUSD: "100" }),
    );
    await assertFails(
      setDoc(doc(as(ANA), path), { ...inUsd, rateJPYPerUSD: 0 }),
    );
    await assertFails(
      setDoc(doc(as(ANA), path), { ...inUsd, originalUSD: -1 }),
    );
  });

  it("may say it was paid by card or in cash", async () => {
    const path = "trips/japan/expenses/e4";
    for (const paymentMethod of ["card", "cash"])
      await assertSucceeds(
        setDoc(doc(as(ANA), path), { ...expense, id: "e4", paymentMethod }),
      );
    await assertFails(
      setDoc(doc(as(ANA), path), {
        ...expense,
        id: "e4",
        paymentMethod: "crypto",
      }),
    );
  });

  it("may name the city it was spent in", async () => {
    const path = "trips/japan/expenses/e2";
    await assertSucceeds(
      setDoc(doc(as(ANA), path), { ...expense, id: "e2", cityId: "tokyo" }),
    );
    await assertFails(
      setDoc(doc(as(ANA), path), { ...expense, id: "e2", cityId: 42 }),
    );
  });
});

describe("cash", () => {
  const withdrawal = {
    id: "c1",
    kind: "withdrawal",
    date: "2026-12-16",
    amountJPY: 20000,
    amountUSD: null,
    by: ANA,
    to: null,
    note: null,
    archived: false,
    updatedAt: NOW,
  };
  const path = "trips/japan/cash/c1";

  it("records withdrawals, with or without the dollars", async () => {
    await assertSucceeds(setDoc(doc(as(ANA), path), withdrawal));
    await assertSucceeds(
      setDoc(doc(as(ANA), path), { ...withdrawal, amountUSD: 128.4 }),
    );
    await assertFails(setDoc(doc(as(EVE), path), withdrawal));
    await assertFails(
      setDoc(doc(as(ANA), path), { ...withdrawal, amountUSD: "128" }),
    );
    await assertFails(
      setDoc(doc(as(ANA), path), { ...withdrawal, amountJPY: 1.5 }),
    );
    await assertFails(
      setDoc(doc(as(ANA), path), { ...withdrawal, kind: "loan" }),
    );
  });

  it("hands cash only to someone else", async () => {
    const handover = { ...withdrawal, kind: "handover", to: BEN };
    await assertSucceeds(setDoc(doc(as(ANA), path), handover));
    await assertFails(setDoc(doc(as(ANA), path), { ...handover, to: null }));
    await assertFails(setDoc(doc(as(ANA), path), { ...handover, to: ANA }));
  });
});

describe("to-dos", () => {
  const list = {
    id: "l1",
    title: "Before we fly",
    description: null,
    color: "#0d9488",
    order: 0,
    archived: false,
    updatedAt: NOW,
  };
  const todo = {
    id: "t1",
    listId: "l1",
    title: "Renew passports",
    description: null,
    dueDate: "2026-12-01",
    status: "todo",
    priority: "high",
    assignee: ANA,
    order: 0,
    completedAt: null,
    archived: false,
    updatedAt: NOW,
  };

  it("keeps lists for members, with only these fields", async () => {
    const path = "trips/japan/todoLists/l1";
    await assertSucceeds(setDoc(doc(as(ANA), path), list));
    await assertFails(setDoc(doc(as(EVE), path), list));
    await assertFails(setDoc(doc(as(ANA), path), { ...list, title: "" }));
    await assertFails(setDoc(doc(as(ANA), path), { ...list, color: "teal" }));
    await assertFails(setDoc(doc(as(ANA), path), { ...list, extra: 1 }));
  });

  it("keeps to-dos with a known status and priority", async () => {
    const path = "trips/japan/todos/t1";
    await assertSucceeds(setDoc(doc(as(ANA), path), todo));
    await assertSucceeds(
      setDoc(doc(as(ANA), path), {
        ...todo,
        status: "done",
        completedAt: NOW,
        dueDate: null,
        assignee: null,
      }),
    );
    await assertFails(setDoc(doc(as(EVE), path), todo));
    await assertFails(setDoc(doc(as(ANA), path), { ...todo, status: "late" }));
    await assertFails(
      setDoc(doc(as(ANA), path), { ...todo, priority: "urgent" }),
    );
    await assertFails(setDoc(doc(as(ANA), path), { ...todo, order: 1.5 }));
    await assertFails(
      setDoc(doc(as(ANA), path), { ...todo, dueDate: "Dec 1" }),
    );
  });
});

describe("stops in the plan", () => {
  const stop = {
    id: "s1",
    placeId: "zoo",
    date: "2026-12-16",
    order: "a0",
    status: "planned",
    updatedAt: NOW,
  };
  const path = "trips/japan/items/s1";

  it("are saved by members, with only these fields", async () => {
    await assertSucceeds(setDoc(doc(as(ANA), path), stop));
    await assertFails(setDoc(doc(as(EVE), path), stop));
    await assertSucceeds(
      setDoc(doc(as(ANA), path), { ...stop, status: "done" }),
    );
    await assertFails(setDoc(doc(as(ANA), path), { ...stop, status: "lost" }));
  });

  it("refuse the details stops no longer have", async () => {
    for (const field of ["startTime", "durationMin", "note", "legNote"])
      await assertFails(setDoc(doc(as(ANA), path), { ...stop, [field]: null }));
  });
});

describe("the trip's budget", () => {
  const budget = {
    totalJPY: 500000,
    byCategory: { food: 100000 },
    travellers: 2,
  };

  it("is set by members, in the right shape", async () => {
    const trip = "trips/peru";
    await assertSucceeds(
      updateDoc(doc(as(BEN), trip), { budget, updatedAt: NOW }),
    );
    await assertFails(
      updateDoc(doc(as(EVE), trip), { budget, updatedAt: NOW }),
    );
    await assertFails(
      updateDoc(doc(as(BEN), trip), {
        budget: { ...budget, byCategory: { bribes: 1 } },
        updatedAt: NOW,
      }),
    );
  });

  it("may hold a target per member", async () => {
    const trip = "trips/peru";
    await assertSucceeds(
      updateDoc(doc(as(BEN), trip), {
        budget: { ...budget, byMember: { [BEN]: 80000 } },
        updatedAt: NOW,
      }),
    );
    await assertFails(
      updateDoc(doc(as(BEN), trip), {
        budget: { ...budget, byMember: "lots" },
        updatedAt: NOW,
      }),
    );
  });
});

describe("clean up", () => {
  const seed = (path: string, data: Record<string, unknown>) =>
    env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), path), data);
    });

  it.each([
    "cities",
    "stays",
    "reservations",
    "places",
    "holidays",
    "expenses",
    "flights",
    "cash",
    "todoLists",
    "todos",
  ])("deletes only archived %s, only for members", async (name) => {
    const live = `trips/japan/${name}/live`;
    const retired = `trips/japan/${name}/retired`;
    await seed(live, { archived: false });
    await seed(retired, { archived: true });
    await assertFails(deleteDoc(doc(as(ANA), live)));
    await assertFails(deleteDoc(doc(as(EVE), retired)));
    await assertSucceeds(deleteDoc(doc(as(ANA), retired)));
  });

  it("deletes only removed stops", async () => {
    await seed("trips/japan/items/live", { status: "planned" });
    await seed("trips/japan/items/gone", { status: "removed" });
    await assertFails(deleteDoc(doc(as(ANA), "trips/japan/items/live")));
    await assertFails(deleteDoc(doc(as(EVE), "trips/japan/items/gone")));
    await assertSucceeds(deleteDoc(doc(as(ANA), "trips/japan/items/gone")));
  });

  it("deletes only finished research", async () => {
    await seed("trips/japan/proposals/open", { status: "ready" });
    await seed("trips/japan/proposals/done", { status: "applied" });
    await assertFails(deleteDoc(doc(as(ANA), "trips/japan/proposals/open")));
    await assertFails(deleteDoc(doc(as(EVE), "trips/japan/proposals/done")));
    await assertSucceeds(deleteDoc(doc(as(ANA), "trips/japan/proposals/done")));
  });

  it("clears history and old queue links for members only", async () => {
    await seed("trips/japan/activity/a", { summary: "x" });
    await seed("trips/japan/queue/q", { url: "https://maps.app.goo.gl/x" });
    await assertFails(deleteDoc(doc(as(EVE), "trips/japan/activity/a")));
    await assertFails(deleteDoc(doc(as(EVE), "trips/japan/queue/q")));
    await assertSucceeds(deleteDoc(doc(as(ANA), "trips/japan/activity/a")));
    await assertSucceeds(deleteDoc(doc(as(ANA), "trips/japan/queue/q")));
  });

  it("no longer takes new queue links", async () => {
    await assertFails(
      setDoc(doc(as(ANA), "trips/japan/queue/new"), { id: "new" }),
    );
  });

  it("never deletes a trip", async () => {
    await assertFails(deleteDoc(doc(as(ANA), "trips/japan")));
  });
});

describe("flights", () => {
  const flight = {
    id: "f1",
    airline: "Sample Air",
    flightNumber: "XX 100",
    departDate: "2026-12-15",
    departTime: "10:00",
    departAirport: "AAA",
    departCity: null,
    arriveDate: "2026-12-15",
    arriveTime: "12:00",
    arriveAirport: "BBB",
    arriveCity: null,
    confirmation: null,
    costAmount: 12.5,
    costCurrency: "USD",
    note: null,
    archived: false,
    updatedAt: NOW,
  };
  const path = "trips/japan/flights/f1";

  it("are read and saved by members only, in the right shape", async () => {
    await assertSucceeds(setDoc(doc(as(ANA), path), flight));
    await assertSucceeds(getDoc(doc(as(ANA), path)));
    await assertFails(getDoc(doc(as(EVE), path)));
    await assertFails(setDoc(doc(as(EVE), path), flight));
    await assertFails(
      setDoc(doc(as(ANA), path), { ...flight, departAirport: "TOKYO" }),
    );
    await assertFails(
      setDoc(doc(as(ANA), path), { ...flight, costCurrency: "EUR" }),
    );
    await assertFails(setDoc(doc(as(ANA), path), { ...flight, gate: "12" }));
  });
});

describe("holidays", () => {
  const holiday = {
    id: "h1",
    date: "2027-01-01",
    name: "New Year's Day",
    kind: "holiday",
    note: null,
    archived: false,
    updatedAt: NOW,
  };

  it("are saved by members, in the right shape", async () => {
    await assertSucceeds(
      setDoc(doc(as(ANA), "trips/japan/holidays/h1"), holiday),
    );
    await assertFails(setDoc(doc(as(EVE), "trips/japan/holidays/h1"), holiday));
    await assertFails(
      setDoc(doc(as(ANA), "trips/japan/holidays/h1"), {
        ...holiday,
        kind: "party",
      }),
    );
  });
});

describe("read-only links", () => {
  const HOUR = 60 * 60 * 1000;
  const at = (ms: number) => Timestamp.fromMillis(Date.now() + ms);
  const link = (fields: Record<string, unknown> = {}) => ({
    tripId: "peru",
    tripName: "Peru",
    label: "Grandma",
    createdAt: NOW,
    expiresAt: at(24 * HOUR),
    revoked: false,
    publishedAt: NOW,
    ...fields,
  });
  const city = {
    id: "lima",
    name: "Lima",
    color: "#2563eb",
    archived: false,
    updatedAt: NOW,
  };
  const place = {
    id: "museo",
    cityId: "lima",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Museo",
    name: "Museo",
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
    status: "researched",
    source: "catalog",
    archived: false,
    updatedAt: NOW,
  };
  const flight = {
    id: "sa-1",
    airline: "Sample Air",
    flightNumber: "SA 1",
    departDate: "2026-12-15",
    departTime: "10:00",
    departAirport: "LIM",
    departCity: null,
    arriveDate: "2026-12-16",
    arriveTime: "15:00",
    arriveAirport: "HND",
    arriveCity: null,
    confirmation: null,
    costAmount: null,
    costCurrency: "JPY",
    note: null,
    archived: false,
    updatedAt: NOW,
  };
  const seed = (id: string, fields: Record<string, unknown> = {}) =>
    env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `shares/${id}`), link(fields));
      await setDoc(doc(db, `shares/${id}/cities/lima`), city);
    });

  it("can be read by anyone while open, by ID only", async () => {
    await seed("open");
    await assertSucceeds(getDoc(doc(anonymous(), "shares/open")));
    await assertSucceeds(
      getDocs(collection(anonymous(), "shares/open/cities")),
    );
    await assertSucceeds(getDoc(doc(as(EVE), "shares/open/cities/lima")));
    await assertFails(getDocs(collection(anonymous(), "shares")));
    await assertFails(
      getDocs(
        query(collection(as(EVE), "shares"), where("tripId", "==", "peru")),
      ),
    );
  });

  it("can't be read once expired or revoked", async () => {
    await seed("old", { expiresAt: at(-HOUR) });
    await seed("closed", { revoked: true });
    for (const id of ["old", "closed"]) {
      await assertFails(getDoc(doc(anonymous(), `shares/${id}`)));
      await assertFails(
        getDocs(collection(anonymous(), `shares/${id}/cities`)),
      );
    }
  });

  it("never open the trip itself", async () => {
    await seed("open");
    await assertFails(getDoc(doc(anonymous(), "trips/peru")));
    await assertFails(getDocs(collection(anonymous(), "trips/peru/expenses")));
  });

  it("are listed and made only by the trip's members", async () => {
    await seed("open");
    await assertSucceeds(
      getDocs(
        query(collection(as(BEN), "shares"), where("tripId", "==", "peru")),
      ),
    );
    await assertSucceeds(setDoc(doc(as(BEN), "shares/new"), link()));
    await assertFails(setDoc(doc(as(EVE), "shares/eve"), link()));
    await assertFails(setDoc(doc(anonymous(), "shares/anon"), link()));
    await assertFails(
      setDoc(
        doc(as(ANA), "shares/other"),
        link({ tripId: "japan", revoked: true }),
      ),
    );
  });

  it("stay open at most 30 days", async () => {
    await assertFails(
      setDoc(
        doc(as(ANA), "shares/long"),
        link({ expiresAt: at(32 * 24 * HOUR) }),
      ),
    );
    await assertFails(
      setDoc(doc(as(ANA), "shares/past"), link({ expiresAt: at(-HOUR) })),
    );
    await seed("open");
    await assertFails(
      updateDoc(doc(as(ANA), "shares/open"), { expiresAt: at(40 * 24 * HOUR) }),
    );
    await assertSucceeds(
      updateDoc(doc(as(ANA), "shares/open"), { expiresAt: at(29 * 24 * HOUR) }),
    );
  });

  it("can't be changed by viewers, moved to another trip or reopened", async () => {
    await seed("open");
    await assertFails(
      updateDoc(doc(anonymous(), "shares/open"), { label: "x" }),
    );
    await assertFails(
      setDoc(doc(anonymous(), "shares/open/cities/lima"), {
        ...city,
        name: "X",
      }),
    );
    await assertFails(deleteDoc(doc(anonymous(), "shares/open/cities/lima")));
    await assertFails(
      updateDoc(doc(as(ANA), "shares/open"), { tripId: "japan" }),
    );
    await assertSucceeds(
      updateDoc(doc(as(ANA), "shares/open"), { revoked: true }),
    );
    await assertFails(
      updateDoc(doc(as(ANA), "shares/open"), { revoked: false }),
    );
  });

  it("copies hold no amount, confirmation or booking note", async () => {
    await seed("open");
    const db = as(ANA);
    await assertSucceeds(setDoc(doc(db, "shares/open/places/museo"), place));
    await assertSucceeds(setDoc(doc(db, "shares/open/flights/sa-1"), flight));
    await assertFails(
      setDoc(doc(db, "shares/open/places/museo"), {
        ...place,
        costEstimateJPY: 500,
      }),
    );
    for (const change of [
      { costAmount: 900 },
      { confirmation: "ABC123" },
      { note: "Seat 3A" },
    ])
      await assertFails(
        setDoc(doc(db, "shares/open/flights/sa-1"), { ...flight, ...change }),
      );
    await assertFails(
      setDoc(doc(db, "shares/open/expenses/x"), {
        id: "x",
        title: "Dinner",
        amountJPY: 8000,
      }),
    );
    await assertFails(
      setDoc(doc(db, "shares/open/items/i1"), {
        id: "i1",
        placeId: "museo",
        date: "2026-12-18",
        order: "a",
        status: "removed",
        updatedAt: NOW,
      }),
    );
  });

  it("are deleted only once closed", async () => {
    await seed("open");
    await seed("old", { expiresAt: at(-HOUR) });
    await assertFails(deleteDoc(doc(as(ANA), "shares/open")));
    await assertFails(deleteDoc(doc(as(EVE), "shares/old")));
    await assertSucceeds(deleteDoc(doc(as(ANA), "shares/old/cities/lima")));
    await assertSucceeds(deleteDoc(doc(as(ANA), "shares/old")));
  });
});

describe("day research", () => {
  const PATH = "trips/japan/dayResearch/2026-12-18";
  const row = (fields = {}) => ({
    id: "2026-12-18",
    date: "2026-12-18",
    status: "requested",
    request: "Any winter lights nearby?",
    analysis: null,
    requestedAt: NOW,
    updatedAt: NOW,
    ...fields,
  });

  it("lets members ask about a day, keyed by its date", async () => {
    await assertSucceeds(setDoc(doc(as(ANA), PATH), row()));
    await assertSucceeds(getDoc(doc(as(ANA), PATH)));
    await assertFails(getDoc(doc(as(EVE), PATH)));
    await assertFails(setDoc(doc(as(EVE), PATH), row()));
  });

  it("refuses a wrong id, status or extra field", async () => {
    await assertFails(
      setDoc(doc(as(ANA), PATH), row({ id: "2026-12-19", date: "2026-12-19" })),
    );
    await assertFails(setDoc(doc(as(ANA), PATH), row({ status: "done" })));
    await assertFails(setDoc(doc(as(ANA), PATH), row({ admin: true })));
    await assertFails(
      setDoc(doc(as(ANA), PATH), row({ request: "x".repeat(1001) })),
    );
  });

  it("deletes only archived research", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, PATH), row());
      await setDoc(
        doc(db, "trips/japan/dayResearch/2026-12-19"),
        row({ id: "2026-12-19", date: "2026-12-19", status: "archived" }),
      );
    });
    await assertFails(deleteDoc(doc(as(ANA), PATH)));
    await assertFails(
      deleteDoc(doc(as(EVE), "trips/japan/dayResearch/2026-12-19")),
    );
    await assertSucceeds(
      deleteDoc(doc(as(ANA), "trips/japan/dayResearch/2026-12-19")),
    );
  });
});
