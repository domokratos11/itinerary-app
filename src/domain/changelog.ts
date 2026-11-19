import type { MessageKey } from "@/domain/i18n";

// What changed, newest first, one short sentence per bullet. The sentences
// live in src/messages/{en,es}.json under changelog.d<date>. Only a type of
// the key is imported, so this file stays free of the current language.
// `version: null` is work not deployed yet: it is given its version when it
// is deployed (CLAUDE.md rule 15). Null entries may only sit at the top.
export type ChangelogEntry = {
  version: string | null;
  date: string; // YYYY-MM-DD, in Tokyo time
  items: readonly MessageKey[];
};

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: null,
    date: "2026-11-18",
    items: [
      "changelog.d20261118.movePlaces",
      "changelog.d20261118.reservations",
      "changelog.d20261118.reservationArchive",
      "changelog.d20261118.kanjiTopics",
      "changelog.d20261118.cityNotesMenu",
      "changelog.d20261118.budgetHint",
    ],
  },
  {
    version: "1.0.21",
    date: "2026-11-18",
    items: [
      "changelog.d20261118.staySignedIn",
      "changelog.d20261118.offlineSafe",
      "changelog.d20261118.offlineAge",
      "changelog.d20261118.kanji",
      "changelog.d20261118.cityNotes",
    ],
  },
  {
    version: "1.0.20",
    date: "2026-11-17",
    items: [
      "changelog.d20261117.showToStaff",
      "changelog.d20261117.numberHelper",
    ],
  },
  {
    version: "1.0.19",
    date: "2026-11-15",
    items: [
      "changelog.d20261115.tripDates",
      "changelog.d20261115.noHotelYet",
      "changelog.d20261115.itineraries",
      "changelog.d20261115.setupWizard",
      "changelog.d20261115.setupChecklist",
      "changelog.d20261115.copyItinerary",
      "changelog.d20261114.researchNotFound",
    ],
  },
  {
    version: "1.0.18",
    date: "2026-11-14",
    items: [
      "changelog.d20261114.phrasebook",
      "changelog.d20261114.misc",
      "changelog.d20261114.budgetCharts",
    ],
  },
  {
    version: "1.0.17",
    date: "2026-11-12",
    items: [
      "changelog.d20261112.palette",
      "changelog.d20261112.colours",
      "changelog.d20261112.quickAdd",
      "changelog.d20261112.changelog",
    ],
  },
];

export type DisplayedEntry = Omit<ChangelogEntry, "version"> & {
  version: string;
};

// Entries not deployed yet are shown under the version the app is running.
export function changelogForDisplay(
  entries: readonly ChangelogEntry[],
  appVersion: string,
): DisplayedEntry[] {
  return entries.map((entry) => ({
    ...entry,
    version: entry.version ?? appVersion,
  }));
}
