/**
 * Validates the JSON files kept in the repo against their Zod schemas: the
 * sample trip the tests use and the app's text. Run with `npm run validate`.
 * Exits with code 1 on any problem.
 *
 * Add a schema to SCHEMAS for each new kind of file, and its folder to
 * FOLDERS. A JSON file with no matching schema is an error, so nothing ships
 * unchecked.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

import { TripDataSchema } from "../src/domain/schemas";

export type SchemaRule = { pattern: RegExp; schema: z.ZodType };

const FOLDERS = ["src/test", "src/messages"];

// The app's text. i18n.test.ts checks both languages have the same keys.
const MessagesSchema: z.ZodType = z.record(
  z.string(),
  z.lazy(() => z.union([z.string().min(1), MessagesSchema])),
);

// Paths are relative to the repo root, using forward slashes.
export const SCHEMAS: SchemaRule[] = [
  { pattern: /^src\/test\/fixture-trip\.json$/, schema: TripDataSchema },
  { pattern: /^src\/messages\/(en|es)\.json$/, schema: MessagesSchema },
];

export function listJsonFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listJsonFiles(full, base);
    return name.endsWith(".json")
      ? [path.relative(base, full).split(path.sep).join("/")]
      : [];
  });
}

export function validateFile(
  relPath: string,
  raw: string,
  rules: SchemaRule[] = SCHEMAS,
): string[] {
  const rule = rules.find((r) => r.pattern.test(relPath));
  if (!rule) return [`${relPath}: no schema registered for this file`];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return [`${relPath}: invalid JSON (${(e as Error).message})`];
  }
  const result = rule.schema.safeParse(json);
  if (result.success) return [];
  return result.error.issues.map(
    (i) => `${relPath}: ${i.path.join(".") || "(root)"}: ${i.message}`,
  );
}

function main() {
  const root = process.cwd();
  const files = FOLDERS.flatMap((folder) =>
    listJsonFiles(path.join(root, folder), root),
  );
  const errors = files.flatMap((f) =>
    validateFile(f, readFileSync(path.join(root, f), "utf8")),
  );
  if (errors.length) {
    console.error(errors.join("\n"));
    console.error(`\n${errors.length} problem(s) found.`);
    process.exit(1);
  }
  console.log(`JSON files are valid (${files.length} file(s) checked).`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}
