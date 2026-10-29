import { generateKeyBetween } from "fractional-indexing";

// Order keys are strings that sort correctly, so moving a stop only changes
// one item's `order` (see the fractional-indexing package).

// Key for a new item after the last one in a list (null for an empty list).
export function keyAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}

// Key for an item dropped between two neighbours (null at either end).
export function keyBetween(
  before: string | null,
  after: string | null,
): string {
  return generateKeyBetween(before, after);
}
