/**
 * Validates every JSON file under data/ against its Zod schema.
 * Run with `npm run validate`. Exits with code 1 on any problem.
 *
 * Add a schema to SCHEMAS for each new kind of data file. A JSON file
 * with no matching schema is an error, so nothing ships unchecked.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

import {
  CitiesFileSchema,
  HolidaysFileSchema,
  PlacesFileSchema,
  TripFileSchema,
} from "../src/domain/schemas";

export type SchemaRule = { pattern: RegExp; schema: z.ZodType };

// Paths are relative to data/, using forward slashes.
export const SCHEMAS: SchemaRule[] = [
  { pattern: /^cities\.json$/, schema: CitiesFileSchema },
  { pattern: /^trip\.json$/, schema: TripFileSchema },
  { pattern: /^holidays\.json$/, schema: HolidaysFileSchema },
  { pattern: /^places\/[a-z0-9-]+\.json$/, schema: PlacesFileSchema },
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
  const dataDir = path.resolve(process.cwd(), "data");
  const files = listJsonFiles(dataDir);
  const errors = files.flatMap((f) =>
    validateFile(f, readFileSync(path.join(dataDir, f), "utf8")),
  );
  if (errors.length) {
    console.error(errors.join("\n"));
    console.error(`\n${errors.length} problem(s) in data/.`);
    process.exit(1);
  }
  console.log(`data/ is valid (${files.length} file(s) checked).`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}
