import { describe, expect, it } from "vitest";
import { z } from "zod";

import { validateFile, type SchemaRule } from "./validate";

const rules: SchemaRule[] = [
  { pattern: /^cities\.json$/, schema: z.array(z.object({ id: z.string() })) },
];

describe("validateFile", () => {
  it("accepts a file that matches its schema", () => {
    expect(validateFile("cities.json", '[{"id":"nagoya"}]', rules)).toEqual([]);
  });

  it("reports schema errors with the field path", () => {
    expect(validateFile("cities.json", '[{"id":1}]', rules)[0]).toMatch(
      /^cities\.json: 0\.id:/,
    );
  });

  it("rejects files with no registered schema", () => {
    expect(validateFile("other.json", "{}", rules)).toEqual([
      "other.json: no schema registered for this file",
    ]);
  });

  it("rejects invalid JSON", () => {
    expect(validateFile("cities.json", "{", rules)[0]).toMatch(/invalid JSON/);
  });
});
