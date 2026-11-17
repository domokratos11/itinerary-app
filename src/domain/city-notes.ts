import { z } from "zod";

import { bilingual } from "@/domain/bilingual";
import type { CityRecord, PlaceRecord, StayRecord } from "@/domain/schemas";

// Background notes on each of the trip's cities: not a travel guide but the
// history, defining moments, traditions and food behind what you'll see, in
// English and Spanish. Researched outside the app (docs/city-research.md):
// the app only asks, and shows what comes back. Like the plan, screens use
// the repository interface and never the Firebase SDK.

const recordId = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(64);
const httpsUrl = z.url({ protocol: /^https$/ }).max(500);
const short = bilingual(200);
const text = bilingual(2000);

export const CITY_NOTES_STATUSES = ["requested", "ready", "archived"] as const;

// The sections, in the order the screen shows them.
export const CITY_NOTE_SECTIONS = [
  "glance",
  "timeline",
  "moments",
  "traditions",
  "food",
  "season",
  "glossary",
  "answers",
  "sources",
] as const;
export type CityNoteSection = (typeof CITY_NOTE_SECTIONS)[number];

// What the research writes for a city. `answers` and `researchedAt` are
// added by the push script, not the researcher.
export const CityBriefSchema = z
  .object({
    // Where it is, its size and what it's known for, in 3 to 4 sentences.
    glance: text,
    // A short dated history: "794", "1600s", "6 Aug 1945".
    timeline: z
      .array(z.object({ when: z.string().min(1).max(40), text }).strict())
      .min(1)
      .max(12),
    // The events that shaped the city, with what to see of them today.
    moments: z
      .array(
        z
          .object({
            title: short,
            when: z.string().min(1).max(60).nullable(),
            text,
            // Where to see it. placeId when it is one of the trip's places.
            places: z
              .array(
                z
                  .object({
                    name: z.string().min(1).max(120),
                    placeId: recordId.nullable(),
                  })
                  .strict(),
              )
              .max(8),
          })
          .strict(),
      )
      .max(6),
    traditions: z.array(z.object({ name: short, text }).strict()).max(10),
    // Each dish explained: what it is, what's in it, how it's eaten.
    food: z
      .array(
        z
          .object({
            name: short,
            japanese: z.string().min(1).max(40).nullable(),
            text,
          })
          .strict(),
      )
      .max(10),
    // What is special in mid-December to early January.
    season: text,
    // Every Japanese term used above, explained.
    glossary: z
      .array(
        z
          .object({
            term: z.string().min(1).max(60),
            japanese: z.string().min(1).max(40).nullable(),
            text: bilingual(600),
          })
          .strict(),
      )
      .max(40),
    sources: z
      .array(
        z
          .object({ url: httpsUrl, note: z.string().max(200).nullable() })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

export const CityAnswerSchema = z
  .object({
    question: z.string().min(1).max(1000),
    answer: bilingual(3000),
    answeredAt: z.iso.datetime(),
  })
  .strict();

export const CityNotesContentSchema = CityBriefSchema.extend({
  answers: z.array(CityAnswerSchema).max(20),
  researchedAt: z.iso.datetime(),
});

// trips/{tripId}/cityNotes/{cityId}.
export const CityNotesSchema = z
  .object({
    id: recordId,
    cityId: recordId,
    status: z.enum(CITY_NOTES_STATUSES),
    // The open "research specifics" message, if any.
    request: z.string().max(1000).nullable(),
    notes: CityNotesContentSchema.nullable(),
    requestedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .refine((n) => n.id === n.cityId, "id must be the city's id");

export type CityBrief = z.infer<typeof CityBriefSchema>;
export type CityNotesContent = z.infer<typeof CityNotesContentSchema>;
export type CityNotes = z.infer<typeof CityNotesSchema>;

export interface CityNotesRepository {
  subscribe(
    tripId: string,
    onRows: (rows: CityNotes[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  save(tripId: string, row: CityNotes): Promise<void>;
}

// Asking for a city's notes, or a specific question about it. The notes
// already there stay visible while the request waits.
export function requestCityNotes(
  cityId: string,
  message: string,
  existing: CityNotes | null,
  now: Date,
): CityNotes {
  const stamp = now.toISOString();
  return {
    id: cityId,
    cityId,
    status: "requested",
    request: message.trim() || null,
    notes: existing?.notes ?? null,
    requestedAt: stamp,
    updatedAt: stamp,
  };
}

// Takes back an open request. Notes already there stay; with none, the
// city is back to having nothing asked.
export function cancelCityRequest(existing: CityNotes, now: Date): CityNotes {
  return {
    ...existing,
    status: existing.notes ? "ready" : "archived",
    request: null,
    updatedAt: now.toISOString(),
  };
}

// One city in a results file. `notes` may be left out when only a question
// was answered and the notes themselves didn't change.
export const CityResultSchema = z
  .object({
    cityId: recordId,
    notes: CityBriefSchema.nullable(),
    answer: bilingual(3000).nullable(),
  })
  .strict();
export type CityResult = z.infer<typeof CityResultSchema>;

// The row after a result: ready, with the answer to the open question added
// to the earlier ones. Null when there is nothing to apply.
export function applyCityResult(
  existing: CityNotes | null,
  result: CityResult,
  now: Date,
): CityNotes | null {
  const stamp = now.toISOString();
  const brief = result.notes ?? existing?.notes ?? null;
  if (!brief) return null;
  const { answers: earlier = [] } = existing?.notes ?? {};
  const question = existing?.request ?? null;
  const answers =
    question && result.answer
      ? [...earlier, { question, answer: result.answer, answeredAt: stamp }]
      : earlier;
  const notes: CityNotesContent = {
    ...CityBriefSchema.parse(stripExtra(brief)),
    answers: answers.slice(-20),
    researchedAt: result.notes
      ? stamp
      : (existing?.notes?.researchedAt ?? stamp),
  };
  return {
    id: result.cityId,
    cityId: result.cityId,
    status: "ready",
    request: null,
    notes,
    requestedAt: existing?.requestedAt ?? stamp,
    updatedAt: stamp,
  };
}

// The brief fields of stored notes, without what the push script adds.
function stripExtra(brief: CityBrief | CityNotesContent): CityBrief {
  const copy: Partial<CityNotesContent> = { ...brief };
  delete copy.answers;
  delete copy.researchedAt;
  return copy as CityBrief;
}

// What the researcher gets for each city to work on.
export type CityResearchRequest = {
  cityId: string;
  name: string;
  // The nights spent there, first and last; null without a stay.
  from: string | null;
  to: string | null;
  // The trip's places in the city, by name only (no Google data).
  places: { id: string; name: string }[];
  request: string | null;
  previousNotes: CityNotesContent | null;
};

// Cities to research: those asked about in the app, and with `missing` also
// every active city with no notes yet. `only` narrows to one city.
export function cityResearchRequests(
  input: {
    cities: CityRecord[];
    stays: StayRecord[];
    places: PlaceRecord[];
    notes: CityNotes[];
  },
  options: { missing: boolean; only?: string | null },
): CityResearchRequest[] {
  const byCity = new Map(input.notes.map((n) => [n.cityId, n]));
  return input.cities
    .filter((city) => !city.archived)
    .filter((city) => !options.only || city.id === options.only)
    .filter((city) => {
      const row = byCity.get(city.id);
      if (row?.status === "requested") return true;
      return options.missing && !row?.notes;
    })
    .map((city) => {
      const row = byCity.get(city.id) ?? null;
      const stays = input.stays
        .filter((s) => !s.archived && s.cityId === city.id)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      return {
        cityId: city.id,
        name: city.name,
        from: stays[0]?.checkIn ?? null,
        to: stays.at(-1)?.checkOut ?? null,
        places: input.places
          .filter((p) => !p.archived && p.cityId === city.id)
          .map((p) => ({ id: p.id, name: p.name })),
        request: row?.status === "requested" ? row.request : null,
        previousNotes: row?.notes ?? null,
      };
    });
}

// The trip's cities in the order they are visited: by first check-in, then
// cities without a stay by name.
export function citiesInTripOrder(
  cities: CityRecord[],
  stays: StayRecord[],
): CityRecord[] {
  const first = new Map<string, string>();
  for (const stay of stays) {
    if (stay.archived) continue;
    const known = first.get(stay.cityId);
    if (!known || stay.checkIn < known) first.set(stay.cityId, stay.checkIn);
  }
  return cities
    .filter((c) => !c.archived)
    .sort((a, b) => {
      const fa = first.get(a.id);
      const fb = first.get(b.id);
      if (fa && fb) return fa.localeCompare(fb);
      if (fa) return -1;
      if (fb) return 1;
      return a.name.localeCompare(b.name);
    });
}
