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
