import { z } from "zod";

import { coordinatesExpired, withoutGoogleCoordinates } from "./location";
import type {
  CityRecord,
  FlightRecord,
  HolidayRecord,
  PlaceRecord,
  PlanItem,
  ReservationRecord,
  StayRecord,
} from "./schemas";
import type { TripData } from "./trip";

// A read-only link to the trip for people who aren't members. They never
// read the trip itself: a member publishes a copy under shares/{shareId}
// with every amount, confirmation number, booking note and member email
// left out, and the rules let anyone read that copy only until it expires
// or is revoked. The copy changes only when a member refreshes it.

// The longest a link may stay open. It also keeps Google coordinates in the
// copy within their 30-day limit, with maps:refresh renewing them.
export const MAX_SHARE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ShareSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  tripName: z.string().nullable(),
  label: z.string().max(100),
  createdAt: z.iso.datetime(),
  // ISO here; a Firestore timestamp in the database, so the rules can
  // compare it with the request time.
  expiresAt: z.iso.datetime(),
  revoked: z.boolean(),
  publishedAt: z.iso.datetime(),
});

export type Share = z.infer<typeof ShareSchema>;

export type ShareStatus = "active" | "expired" | "revoked";

export function shareStatus(share: Share, now: Date): ShareStatus {
  if (share.revoked) return "revoked";
  return Date.parse(share.expiresAt) > now.getTime() ? "active" : "expired";
}

// The latest expiry allowed from now.
export function latestExpiry(now: Date): Date {
  return new Date(now.getTime() + MAX_SHARE_DAYS * DAY_MS);
}

// Keeps a chosen expiry between now and the 30-day limit.
export function clampExpiry(chosen: Date, now: Date): Date {
  const latest = latestExpiry(now).getTime();
  return new Date(Math.min(Math.max(chosen.getTime(), now.getTime()), latest));
}

// 128 random bits, URL-safe: the link is the only key, so it can't be guessed.
export function newShareId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export function parseShareId(value: string | null | undefined): string | null {
  if (!value) return null;
  return SHARE_ID_PATTERN.test(value) ? value : null;
}

// What a viewer gets: the trip's structure and plan without to-dos, expenses, cash,
// the budget or anything else about money.
export type SharedTrip = {
  cities: CityRecord[];
  stays: StayRecord[];
  reservations: ReservationRecord[];
  places: PlaceRecord[];
  holidays: HolidayRecord[];
  flights: FlightRecord[];
  items: PlanItem[];
};

export type SharedCollection = keyof SharedTrip;
export const SHARED_COLLECTIONS: SharedCollection[] = [
  "cities",
  "stays",
  "reservations",
  "places",
  "holidays",
  "flights",
  "items",
];

// The copy a viewer may see. Archived records and removed stops stay out,
// and so do Google coordinates already past their 30 days.
export function toSharedTrip(
  trip: TripData,
  items: PlanItem[],
  now: Date,
): SharedTrip {
  const live = <T extends { archived: boolean }>(rows: T[]) =>
    rows.filter((r) => !r.archived);
  const located = <T extends Parameters<typeof coordinatesExpired>[0]>(r: T) =>
    coordinatesExpired(r, now) ? withoutGoogleCoordinates(r) : r;
  return {
    cities: live(trip.cities),
    stays: live(trip.stays).map((s) => located({ ...s, note: null })),
    reservations: live(trip.reservations).map((r) => ({ ...r, note: null })),
    places: live(trip.places).map((p) =>
      located({ ...p, costEstimateJPY: null }),
    ),
    holidays: live(trip.holidays),
    flights: live(trip.flights).map((f) => ({
      ...f,
      confirmation: null,
      costAmount: null,
      costCurrency: "JPY" as const,
      note: null,
    })),
    items: items.filter((i) => i.status !== "removed"),
  };
}

// The viewer's trip as the stores hold it: no expenses, and Google
// coordinates that aged past their limit while the link was open dropped.
export function sharedTripData(shared: SharedTrip, now: Date): TripData {
  const located = <T extends Parameters<typeof coordinatesExpired>[0]>(r: T) =>
    coordinatesExpired(r, now) ? withoutGoogleCoordinates(r) : r;
  return {
    cities: shared.cities,
    stays: shared.stays.map(located),
    reservations: shared.reservations,
    places: shared.places.map(located),
    holidays: shared.holidays,
    expenses: [],
    flights: shared.flights,
    cash: [],
    todoLists: [],
    todos: [],
  };
}
