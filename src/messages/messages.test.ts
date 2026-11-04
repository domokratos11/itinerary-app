import { describe, expect, it } from "vitest";

import en from "./en.json";
import es from "./es.json";

// Every label starts with a capital letter. Only text that is always placed
// in the middle of a sentence may start in lowercase.
const MID_SENTENCE = [
  /^activity\./,
  /^home\.(noStaysAfter|untilFirstDay|untilFirstDayNoCity)$/,
  /^settings\.aGoogleAccount$/,
  /^misc\.(noLongerTripDay|cityNotOnDay)$/,
  /^dashboard\.(andMore|placesWord)$/,
];

function entries(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    entries(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe.each([
  ["en", en],
  ["es", es],
])("%s messages", (_, messages) => {
  it("start with a capital letter", () => {
    const lowercase = entries(messages)
      .filter(([key]) => !MID_SENTENCE.some((pattern) => pattern.test(key)))
      .filter(([, text]) => /^\p{Ll}/u.test(text))
      .map(([key, text]) => `${key}: ${text}`);
    expect(lowercase).toEqual([]);
  });
});
