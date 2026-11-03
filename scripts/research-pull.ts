/**
 * Exports research requests for a research run, as described in
 * docs/research-run.md. Run with `TRIP_ID=<id> npm run research:pull`.
 *
 * Normally this exports what was asked for in the app. With --all-missing it
 * first requests research for every place with empty fields, optionally only
 * --city <id> and at most --limit <n>.
 *
 * Requests for a place that has been archived can't be researched, so they are
 * dismissed and listed. Writes research/proposals-<date>.json (git-ignored),
 * or -2, -3 and so on when that file exists, so a list still being researched
 * is never overwritten. With nothing waiting it writes no file.
 *
 * Days asked about in the app (trips/{tripId}/dayResearch, status
 * "requested") also get a research request for every place on them that has
 * none open, and are written to research/days-<date>.json for the day
 * analysis. A request for a day the stays no longer have is archived.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { fileURLToPath } from "node:url";

import { adminDb } from "./admin-db";
import { dayBrief, dayPlaces } from "../src/domain/day-research";
import { deriveDays, weekdayOf } from "../src/domain/days";
import { nightStay } from "../src/domain/trip";
import { missingFields, needsResearch } from "../src/domain/place-edit";
import { isOpenProposal, newProposal } from "../src/domain/proposals";
import {
  DayResearchSchema,
  FlightRecordSchema,
  HolidayRecordSchema,
  PlaceRecordSchema,
  PlanItemSchema,
  ProposalSchema,
  ReservationRecordSchema,
  StayRecordSchema,
  type Proposal,
} from "../src/domain/schemas";
import { parseTripId } from "../src/lib/trip-id";

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

// Requests whose place is archived or gone. `livePlaceIds` comes from the raw
// documents, so a place that merely fails the schema doesn't count as gone.
export function orphanedRequests(
  proposals: Proposal[],
  livePlaceIds: ReadonlySet<string>,
): Proposal[] {
  return proposals.filter(
    (p) => p.status === "requested" && !livePlaceIds.has(p.placeId),
  );
}

// The first name for this date that `taken` says is free.
export function freeFileName(
  date: string,
  taken: (name: string) => boolean,
  prefix = "proposals",
): string {
  let name = `${prefix}-${date}.json`;
  for (let n = 2; taken(name); n += 1) name = `${prefix}-${date}-${n}.json`;
  return name;
}

function parsed<T>(docs: { data(): unknown }[], schema: z.ZodType<T>): T[] {
  return docs.flatMap((d) => {
    const r = schema.safeParse(d.data());
    return r.success ? [r.data] : [];
  });
}

async function main() {
  const tripId = parseTripId(process.env.TRIP_ID);
  if (!tripId) {
    console.error("Set TRIP_ID, e.g. TRIP_ID=abc123 npm run research:pull");
    process.exit(1);
  }
  const db = adminDb();

  const placeDocs = (await db.collection(`trips/${tripId}/places`).get()).docs;
  const places = placeDocs
    .flatMap((d) => {
      const r = PlaceRecordSchema.safeParse(d.data());
      return r.success ? [r.data] : [];
    })
    .filter((p) => !p.archived);
  const livePlaceIds = new Set(
    placeDocs.filter((d) => d.data().archived !== true).map((d) => d.id),
  );
  const cityNames = new Map(
    (await db.collection(`trips/${tripId}/cities`).get()).docs.map((d) => [
      d.id,
      String(d.data().name),
    ]),
  );
  const proposals = (
    await db.collection(`trips/${tripId}/proposals`).get()
  ).docs.flatMap((d) => {
    const r = ProposalSchema.safeParse(d.data());
    return r.success ? [r.data] : [];
  });

  const stamp = new Date().toISOString();
  for (const orphan of orphanedRequests(proposals, livePlaceIds)) {
    await db
      .doc(`trips/${tripId}/proposals/${orphan.id}`)
      .update({ status: "dismissed", updatedAt: stamp });
    orphan.status = "dismissed";
    console.log(`${orphan.placeId}: place is archived, request dismissed`);
  }

  if (process.argv.includes("--all-missing")) {
    const open = new Set(
      proposals.filter(isOpenProposal).map((p) => p.placeId),
    );
    const city = argument("city");
    const limit = Number(argument("limit") ?? Infinity);
    const now = new Date();
    const added = places
      .filter(
        (p) =>
          needsResearch(p) && !open.has(p.id) && (!city || p.cityId === city),
      )
      .slice(0, limit)
      .map((p) => newProposal(crypto.randomUUID(), p.id, now));
    for (const proposal of added) {
      await db.doc(`trips/${tripId}/proposals/${proposal.id}`).set(proposal);
      proposals.push(proposal);
    }
    console.log(`${added.length} new requests`);
  }

  // Days asked about: every place on them gets a request too.
  const load = async (name: string) =>
    (await db.collection(`trips/${tripId}/${name}`).get()).docs;
  const days = parsed(await load("dayResearch"), DayResearchSchema).filter(
    (d) => d.status === "requested",
  );
  const dayFiles: ReturnType<typeof dayBrief>[] = [];
  if (days.length > 0) {
    const live = <T extends { archived: boolean }>(rows: T[]) =>
      rows.filter((r) => !r.archived);
    const stays = live(parsed(await load("stays"), StayRecordSchema));
    const items = parsed(await load("items"), PlanItemSchema);
    const holidays = live(parsed(await load("holidays"), HolidayRecordSchema));
    const reservations = live(
      parsed(await load("reservations"), ReservationRecordSchema),
    );
    const flights = live(parsed(await load("flights"), FlightRecordSchema));
    const tripDays = new Map(deriveDays(stays).map((d) => [d.date, d]));
    const placesById = new Map(places.map((p) => [p.id, p]));
    const now = new Date();
    for (const day of days) {
      const tripDay = tripDays.get(day.date);
      if (!tripDay) {
        await db
          .doc(`trips/${tripId}/dayResearch/${day.id}`)
          .update({ status: "archived", updatedAt: now.toISOString() });
        console.log(`${day.date}: no longer a day of the trip, archived`);
        continue;
      }
      const stops = dayPlaces(day.date, items, placesById);
      const open = new Map(
        proposals.filter(isOpenProposal).map((p) => [p.placeId, p.id]),
      );
      for (const place of stops) {
        if (open.has(place.id)) continue;
        const proposal = newProposal(crypto.randomUUID(), place.id, now);
        await db.doc(`trips/${tripId}/proposals/${proposal.id}`).set(proposal);
        proposals.push(proposal);
        open.set(place.id, proposal.id);
      }
      const holiday = holidays.find((h) => h.date === day.date) ?? null;
      dayFiles.push(
        dayBrief({
          research: day,
          weekday: weekdayOf(day.date),
          cities: tripDay.cityIds.map((id) => cityNames.get(id) ?? id),
          hotel: nightStay(day.date, stays)?.hotelName ?? null,
          holiday: holiday && {
            name: holiday.name,
            kind: holiday.kind,
            note: holiday.note,
          },
          // Times and places only: never a booking's note or reference.
          reservations: reservations
            .filter((r) => r.date === day.date)
            .map((r) => ({
              type: r.type,
              time: r.time,
              from: r.from,
              to: r.to,
            })),
          flights: flights
            .filter(
              (f) => f.departDate === day.date || f.arriveDate === day.date,
            )
            .map((f) => ({
              flightNumber: f.flightNumber,
              departDate: f.departDate,
              departTime: f.departTime,
              arriveDate: f.arriveDate,
              arriveTime: f.arriveTime,
            })),
          stops,
          proposalIds: open,
        }),
      );
    }
  }

  const byId = new Map(places.map((p) => [p.id, p]));
  const requests = proposals
    .filter((proposal) => proposal.status === "requested")
    .flatMap((proposal) => {
      const place = byId.get(proposal.placeId);
      if (!place) return [];
      return [
        {
          proposalId: proposal.id,
          city: cityNames.get(place.cityId) ?? place.cityId,
          missing: missingFields(place),
          lockedFields: place.lockedFields,
          place: {
            id: place.id,
            name: place.name,
            category: place.category,
            mapsUrl: place.mapsUrl,
            purpose: place.purpose,
            description: place.description,
            tips: place.tips,
            costEstimateJPY: place.costEstimateJPY,
            durationMin: place.durationMin,
            openingHours: place.openingHours,
            closedDates: place.closedDates,
            seasonFrom: place.seasonFrom,
            seasonTo: place.seasonTo,
            websiteUrl: place.websiteUrl,
            notes: place.notes,
            nearestStation: place.nearestStation,
          },
        },
      ];
    });

  console.log(`${requests.length} requests waiting for research`);
  console.log(`${dayFiles.length} days waiting for an analysis`);
  if (requests.length === 0 && dayFiles.length === 0) process.exit(0);

  const dir = path.resolve(process.cwd(), "research");
  mkdirSync(dir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const write = (prefix: string, rows: unknown[]) => {
    if (rows.length === 0) return;
    const file = path.join(
      dir,
      freeFileName(today, (name) => existsSync(path.join(dir, name)), prefix),
    );
    writeFileSync(file, JSON.stringify(rows, null, 2) + "\n");
    console.log(`Written to ${path.relative(process.cwd(), file)}`);
  };
  write("proposals", requests);
  write("days", dayFiles);
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
