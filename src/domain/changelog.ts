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
